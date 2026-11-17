// 线上任务「发素材」带附件、一次多选 20 张图、1 万字，「退回修改」附截图、5000 字（V41，2026-10-15）的静态回归（node --test，不构建、不发请求）。
// 守住这几件事：
//   · 前后端上限一致：图片 20 张、文件 5 个、单个 100MB（2026-10-16 起，之前 10MB；超过 8MB 的分段上传）、素材 1 万字、退回 5000 字、截图 9 张；textarea 写 maxlength="-1"（不写只能输 140 字，
//     写上限又会把粘贴的长文悄悄截掉），超了字数变红、发送前拦下；
//   · 图片 3 张并发上传、按选择顺序排好、失败的汇总写明第几张 / 哪个文件（红字）；一次选多了提示只加前几张；本机先挡掉格式不对 / 超过 100MB 的文件；
//   · 前端调的附件接口和后端映射一致（上传、移除、下载、签名链接，门店和接单人两边）；
//   · 新逻辑放在各自分包目录的本地模块里，两个分包不互相引用（否则 uni-app 会把模块挪进主包）；
//   · 接单人那边按端给按钮：文档「打开」、压缩包「发到微信聊天」/「保存到电脑」、H5「下载」，都能「复制下载链接」。
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const read = async (p) => (await readFile(new URL(p, import.meta.url), 'utf8')).replace(/\r\n/g, '\n')
const javaRoot = '../../RuoYi-Vue/ruoyi-kangaroo/src/main/java/com/ruoyi/kangaroo/'
const materialJava = await read(javaRoot + 'ext/staff/KgOnlineMaterialService.java')
const filesJava = await read(javaRoot + 'ext/staff/KgOnlineMaterialFiles.java')
const taskJava = await read(javaRoot + 'ext/staff/KgOnlineTaskService.java')
const staffCtl = await read(javaRoot + 'controller/app/AppStaffOnlineMaterialController.java')
const workerCtl = await read(javaRoot + 'controller/app/AppOnlineController.java')
const extCtl = await read(javaRoot + 'controller/app/AppStaffExtController.java')
const fileCtl = await read(javaRoot + 'controller/KgPrivateFileController.java')
const onlineJobs = await read('../pages/staff/online-jobs.vue')
const deliver = await read('../pages/jobs/deliver.vue')
const staffHelperSrc = await read('../pages/staff/online-material.js')
const jobsHelperSrc = await read('../pages/jobs/material-files.js')
const staff = await import('../pages/staff/online-material.js')
const jobs = await import('../pages/jobs/material-files.js')

const javaInt = (src, name) => Number(new RegExp('static final (?:int|long) ' + name + ' = ([0-9L* ]+);').exec(src)?.[1].replace(/L/g, '').split('*').reduce((a, b) => a * Number(b), 1))

test('前后端上限一致', () => {
  assert.equal(staff.MAX_IMAGES, javaInt(materialJava, 'MAX_IMAGES'))
  assert.equal(staff.MAX_IMAGES, 20)
  assert.equal(staff.MAX_TEXT, javaInt(materialJava, 'MAX_CONTENT'))
  assert.equal(staff.MAX_TEXT, 10000)
  assert.equal(staff.MAX_FILES, javaInt(materialJava, 'MAX_FILES'))
  assert.equal(staff.MAX_FILE_MB * 1024 * 1024, javaInt(filesJava, 'MAX_BYTES'))
  assert.equal(staff.MAX_FILE_MB, 100)
  assert.equal(staff.PART_BYTES, javaInt(filesJava, 'PART_BYTES'))
  assert.ok(staff.PART_BYTES < javaInt(filesJava, 'DIRECT_MAX_BYTES'), '整个传的文件不超过 Spring multipart 的 10MB')
  assert.equal(staff.MAX_RETURN_TEXT, javaInt(taskJava, 'RETURN_MAX'))
  assert.equal(staff.MAX_RETURN_TEXT, 5000)
  assert.equal(staff.MAX_SHOTS, javaInt(taskJava, 'REVIEW_IMAGES_MAX'))
  assert.equal(javaInt(taskJava, 'COMMENT_MAX'), 200, '验收通过的评语仍是 200 字')
  // 允许的扩展名两边一样
  const javaExts = [...filesJava.matchAll(/(?:ARCHIVES|DOCUMENTS) = Arrays\.asList\(([^)]*)\)/g)].flatMap((m) => m[1].match(/"([a-z0-9]+)"/g).map((x) => x.slice(1, -1)))
  assert.deepEqual([...javaExts].sort(), [...staff.FILE_EXTS].sort())
  assert.deepEqual([...staff.OPENABLE_EXTS].sort(), /DOCUMENTS = Arrays\.asList\(([^)]*)\)/.exec(filesJava)[1].match(/"([a-z]+)"/g).map((x) => x.slice(1, -1)).sort())
})

test('输入框不限长度（不写只能输 140 字，写上限又会把粘贴的长文悄悄截掉），超了字数变红、发送前拦下', () => {
  // 2026-10-15 复核：写成 10000 / 5000 时，粘贴 10001 字会被输入框截成 10000 字直接发出去，发送前的检查永远走不到
  assert.match(onlineJobs, /v-model="materialText"[^>]*:maxlength="-1"/)
  assert.match(onlineJobs, /v-model="returnReason"[^>]*:maxlength="-1"/)
  assert.doesNotMatch(onlineJobs, /:maxlength="(?:200|1000|5000|10000)"/)
  assert.match(onlineJobs, /:class="\{ 'k-alert': textLen\(materialText\) > MAX_TEXT \}">\{\{ countText\(materialText, MAX_TEXT\) \}\}/)
  assert.match(onlineJobs, /:class="\{ 'k-alert': textLen\(returnReason\) > MAX_RETURN_TEXT \}">\{\{ countText\(returnReason, MAX_RETURN_TEXT\) \}\}/)
  assert.match(onlineJobs, /if \(content\.length > MAX_TEXT\) \{ materialError\.value = '素材说明太长了/)
  assert.match(onlineJobs, /if \(reason\.length > MAX_RETURN_TEXT\) \{ reviewError\.value = '退回说明不能超过 '/)
  assert.equal(staff.countText('一'.repeat(12), 10000), '已写 12 字')
  assert.equal(staff.countText('一'.repeat(4600), 5000), '4600/5000')
  assert.equal(staff.countText('一'.repeat(10001), 10000), '10001/10000')
  // 和发送前的检查、服务端一样，去掉首尾空白再算
  assert.equal(staff.textLen('  ' + '一'.repeat(10000) + '\n\n'), 10000)
  assert.equal(staff.countText('\n' + '一'.repeat(12) + ' ', 10000), '已写 12 字')
  assert.equal(staff.foldText('短'), '短')
  assert.equal(staff.foldText('长'.repeat(301)), '长'.repeat(300) + '…')
  assert.equal(staff.foldText('长'.repeat(50), 40), '长'.repeat(40) + '…')
})

test('图片 3 张并发上传，按选择顺序排好，失败的最后汇总', async () => {
  let inFlight = 0
  let peak = 0
  const upload = async (p) => {
    inFlight++
    peak = Math.max(peak, inFlight)
    await new Promise((r) => setTimeout(r, p === 'b' ? 15 : 3))
    inFlight--
    if (p === 'd' || p === 'f') throw new Error('图片不能超过 5MB')
    return '/profile/upload/' + p + '.jpg'
  }
  const progress = []
  const r = await staff.uploadAll(['a', 'b', 'c', 'd', 'e', 'f', 'g'], upload, (done, total) => progress.push(done + '/' + total))
  assert.equal(peak, 3)
  assert.deepEqual(r.urls, ['a', 'b', 'c', 'e', 'g'].map((p) => '/profile/upload/' + p + '.jpg'))
  assert.equal(r.failed, 2)
  assert.equal(r.reason, '图片不能超过 5MB')
  assert.deepEqual(r.failedAt, [3, 5])
  assert.deepEqual(progress, ['1/7', '2/7', '3/7', '4/7', '5/7', '6/7', '7/7'])
  // 写明是这次选的第几张没传上
  assert.equal(staff.failedNote(r.failedAt, r.reason), '第 4、6 张没传上（图片不能超过 5MB），可以重新添加')
  assert.equal(staff.failedNote([0, 1, 2, 3, 4, 5, 6], '网络连接失败'), '第 1、2、3、4、5 张等 7 张没传上（网络连接失败），可以重新添加')
  assert.equal(staff.failedNote([2], ''), '第 3 张没传上，可以重新添加')
  assert.equal(staff.failedNote([], ''), '')
  assert.deepEqual(await staff.uploadAll([], upload), { urls: [], failed: 0, reason: '', failedAt: [] })
})

test('一次选多了不再悄悄丢掉：网页版放宽选择数量拿到全部，页面只取放得下的并提示', () => {
  assert.equal(staff.overPickNote(21, 20), '最多还能加 20 张，只加前 20 张')
  assert.equal(staff.overPickNote(4, 3, '个', '文件'), '最多还能加 3 个文件，只加前 3 个')
  assert.equal(staff.overPickNote(3, 3, '个', '文件'), '')
  // uni-app 网页版 chooseImage / chooseFile 会把超出 count 的直接丢掉，所以多选时把 count 放宽；小程序的选择框自己拦，不放宽
  assert.match(staffHelperSrc, /\/\/ #ifdef H5\s+if \(count > 1\) max = H5_PICK_ALL\s+\/\/ #endif/)
  assert.match(staffHelperSrc, /uni\.chooseFile\(\{\s*count: count > 1 \? H5_PICK_ALL : count,/)
  // 发素材的图片、文件和退回截图三处都经过 takeRoom（截取 + 提示）
  assert.match(onlineJobs, /const paths = takeRoom\(await pickImages\(left\), left, '张'\)[\s\S]*picked = takeRoom\(await pickFiles\(left\), left, '个', '文件'\)[\s\S]*const paths = takeRoom\(await pickImages\(left\), left, '张'\)/)
  assert.doesNotMatch(onlineJobs, /await pick(?:Images|Files)\(left\)\)\.slice/)
  assert.match(onlineJobs, /const over = overPickNote\(list\.length, left, unit, noun\)\s+if \(over\) toast\(over\)/)
})

test('没加上的文件写明文件名（长名字缩短），失败说明用红字、放在按钮上面', () => {
  assert.equal(staff.shortName('拍摄原图.zip'), '拍摄原图.zip')
  assert.equal(staff.shortName('门店拍摄原图第一批精修版本最终版本.zip'), '门店拍摄原图第一批精修….zip')
  assert.equal(staff.shortName('门店拍摄原图第一批精修版本最终版本.zip').length, 16)
  assert.match(staff.shortName('一'.repeat(30)), /^一+…$/)
  assert.equal(staff.filesFailedNote([]), '')
  assert.equal(staff.filesFailedNote([{ name: '拍摄原图.zip', reason: '文件内容和格式对不上（.zip）' }]), '「拍摄原图.zip」没加上：文件内容和格式对不上（.zip）')
  assert.equal(staff.filesFailedNote([
    { name: '安装包.exe', reason: staff.TYPE_HINT },
    { name: '大.zip', reason: staff.fileProblem({ name: '大.zip', size: 101 * 1024 * 1024 }) },
    { name: '工具.exe', reason: staff.TYPE_HINT }
  ]), '「安装包.exe」「工具.exe」没加上：' + staff.TYPE_HINT + '；「大.zip」没加上：超过 100MB，可以分成几个压缩包，或把网盘链接写在文字里')
  assert.match(onlineJobs, /fails\.push\(\{ name: f\.name, reason: errText\(e, '上传失败，请重试'\) \}\)/)
  assert.match(onlineJobs, /uploadNote\.value = filesFailedNote\(fails\)/)
  // 上传中是灰字进度，传完剩下的就是失败说明，用红字；都放在 scroll-view 外面，不会跟着图片滚走
  assert.match(onlineJobs, /<\/view><\/scroll-view>\s*<!--[^>]*-->\s*<text v-if="uploadNote" class="upload-note" :class="uploading \? 'k-meta' : 'k-alert'">/)
  assert.match(onlineJobs, /<\/view><\/scroll-view>\s*<text v-if="returnNote" class="upload-note" :class="returnUploading \? 'k-meta' : 'k-alert'">/)
  assert.doesNotMatch(onlineJobs, /class="k-meta upload-note">\{\{ (?:uploadNote|returnNote) \}\}/)
})

test('文字细节：网页版不提「小程序」，网页版附件提示「点击下载」，只附截图的退回接单人那边也有说明', () => {
  // 上传附件时的「别走开」：小程序才说「请不要离开小程序」
  assert.match(staffHelperSrc, /export let STAY_HINT = '，请不要关闭页面'\s+\/\/ #ifdef MP-WEIXIN\s+STAY_HINT = '，请不要离开小程序'\s+\/\/ #endif/)
  assert.doesNotMatch(onlineJobs, /请不要离开小程序/)
  // 门店交付记录里附件下面的提示和菜单对上：网页版都能下载，小程序里文档能打开
  assert.match(onlineJobs, /let how = f\.openable \? '打开或' : ''\s+\/\/ #ifdef H5\s+how = '下载或'\s+\/\/ #endif\s+return '点击' \+ how \+ '复制下载链接'/)
  assert.match(onlineJobs, /\{\{ matFile\.sizeLabel \}\} · \{\{ fileTapHint\(matFile\) \}\}/)
  // 接单人交付页：门店只附了截图时「退回原因」下面不再空着
  assert.match(deliver, /<text v-if="x\.comment" class="review__text k-mt8">[^\n]*\n\s*<text v-else class="k-meta block k-mt8">（门店只附了截图，见下方）<\/text>/)
  // 通知正文不套两层括号
  assert.doesNotMatch(materialJava, /个文件（压缩包\/文档）"\)/)
  assert.match(materialJava, /"：压缩包\/文档"/)
})

test('选好的文件先在本机挡掉格式不对、超过 100MB 的', () => {
  assert.equal(staff.fileProblem({ name: '原图.ZIP', size: 1024 }), '')
  assert.equal(staff.fileProblem({ name: '方案.pptx', size: 10 * 1024 * 1024 }), '')
  assert.equal(staff.fileProblem({ name: '六张原图.zip', size: 35 * 1024 * 1024 }), '', '主人那种 30 多 MB 的原图包能加')
  assert.equal(staff.fileProblem({ name: '正好.zip', size: 100 * 1024 * 1024 }), '')
  assert.equal(staff.fileProblem({ name: '安装包.exe', size: 1 }), staff.TYPE_HINT)
  assert.equal(staff.fileProblem({ name: '没有扩展名', size: 1 }), staff.TYPE_HINT)
  // 文件名由汇总那句（filesFailedNote）带上，这里只给原因
  assert.match(staff.fileProblem({ name: '大.zip', size: 100 * 1024 * 1024 + 1 }), /^超过 100MB/)
  assert.equal(staff.extOf('a.b.7Z'), '7z')
  // 服务端回包：413（nginx 拦下的超大请求）和业务错误都当失败
  assert.deepEqual(staff.parseUpload({ statusCode: 200, data: '{"code":200,"data":{"fileId":3}}' }), { data: { fileId: 3 } })
  assert.deepEqual(staff.parseUpload({ statusCode: 200, data: '{"code":422,"msg":"只能发 zip"}' }), { error: '只能发 zip' })
  assert.match(staff.parseUpload({ statusCode: 413, data: '<html>' }).error, /太大/)
  assert.deepEqual(staff.parseUpload({ statusCode: 502, data: '<html>' }), { error: '上传失败，请重试' })
})

test('选图优先 chooseMedia（一次 20 张），选文件用 chooseMessageFile 且 type 为 file（extension 才生效）', () => {
  assert.match(staffHelperSrc, /wx\.chooseMedia\(\{\s*count, mediaType: \['image'\]/)
  assert.match(staffHelperSrc, /max = Math\.min\(9, count\)/)
  assert.match(staffHelperSrc, /wx\.chooseMessageFile\(\{\s*count, type: 'file', extension: FILE_EXTS/)
  assert.match(staffHelperSrc, /formData: \{ name: f\.name \}/, '小程序上传时文件名是临时名，原名放在 name 里')
  assert.match(staffHelperSrc, /timeout: 600000/)
})

const mapping = (ctl, method, base) => [...ctl.matchAll(new RegExp('@' + method + 'Mapping\\("([^"]+)"\\)', 'g'))].map((m) => base + m[1])

test('前端调的附件接口与后端映射一致', () => {
  const staffBase = /@RequestMapping\("([^"]+)"\)/.exec(staffCtl)[1]
  const workerBase = /@RequestMapping\("([^"]+)"\)/.exec(workerCtl)[1]
  assert.ok(mapping(staffCtl, 'Post', staffBase).includes('/app/staff/online/assignments/{appId}/material-files'))
  assert.ok(mapping(staffCtl, 'Delete', staffBase).includes('/app/staff/online/assignments/{appId}/material-files/{fileId}'))
  assert.ok(mapping(staffCtl, 'Get', staffBase).includes('/app/staff/online/assignments/{appId}/material-files/{fileId}'))
  assert.ok(mapping(staffCtl, 'Get', staffBase).includes('/app/staff/online/assignments/{appId}/material-files/{fileId}/link'))
  assert.ok(mapping(workerCtl, 'Get', workerBase).includes('/app/online/assignments/{appId}/material-files/{fileId}'))
  assert.ok(mapping(workerCtl, 'Get', workerBase).includes('/app/online/assignments/{appId}/material-files/{fileId}/link'))
  assert.match(fileCtl, /@Anonymous\s+@GetMapping\("\/kangaroo\/file\/material"\)/)
  assert.match(filesJava, /"\/kangaroo\/file\/material\?f=" \+ fileId \+ "&e=" \+ exp \+ "&s="/)
  // 前端拼的地址
  assert.match(staffHelperSrc, /'\/app\/staff\/online\/assignments\/' \+ appId \+ '\/material-files'/)
  assert.equal(staff.storeFilePath(7, 3), '/app/staff/online/assignments/7/material-files/3')
  assert.equal(staff.linkPath(7, 3), '/app/staff/online/assignments/7/material-files/3/link')
  assert.equal(jobs.workerFilePath(7, 3), '/app/online/assignments/7/material-files/3')
  assert.match(onlineJobs, /request\(\{ url: '\/app\/staff\/online\/assignments\/' \+ A\.value\.appId \+ '\/material-files\/' \+ f\.fileId, method: 'DELETE' \}\)/)
  // 主包 common/request.js 的 del 没有别处用到（构建时被摇掉），分包页面引用它会让主包变大；用已经打进主包的 request
  assert.doesNotMatch(onlineJobs, /import \{[^}]*\bdel\b[^}]*\} from '@\/common\/request\.js'/)
  assert.match(deliver, /get\(path \+ '\/link'\)/)
  // 发素材带上文件 ID；退回带上截图（页面里直接调，不改主包 common/api.js）
  assert.match(onlineJobs, /files: materialFiles\.value\.map\(\(f\) => f\.fileId\)/)
  assert.match(onlineJobs, /post\('\/app\/staff\/online\/assignments\/' \+ appId \+ '\/return', \{ reason, images \}\)/)
  assert.match(extCtl, /online\.review\(c, appId, false, s\(body, "reason"\), body == null \? null : body\.get\("images"\)\)/)
  assert.match(materialJava, /fileIds\(body == null \? null : body\.get\("files"\)\)/)
})

test('新逻辑放在各自分包的本地模块里，两个分包不互相引用（否则会被挪进主包）', async () => {
  const users = { 'online-material.js': [], 'material-files.js': [] }
  const walk = async (dir) => {
    for (const e of await readdir(join(ROOT, dir), { withFileTypes: true })) {
      const rel = dir + '/' + e.name
      if (e.isDirectory()) await walk(rel)
      else if (/\.(vue|js)$/.test(e.name)) {
        const src = await readFile(join(ROOT, rel), 'utf8')
        // 只认 import 语句（注释里提到对方的文件名不算引用）
        for (const k of Object.keys(users)) if (new RegExp("from '[^']*" + k.replace('.', '\\.') + "'").test(src)) users[k].push(rel)
      }
    }
  }
  for (const d of ['pages', 'components', 'common']) await walk(d)
  assert.deepEqual(users['online-material.js'], ['pages/staff/online-jobs.vue'])
  assert.deepEqual(users['material-files.js'], ['pages/jobs/deliver.vue'])
  assert.match(onlineJobs, /from '\.\/online-material\.js'/)
  assert.match(deliver, /from '\.\/material-files\.js'/)
  for (const src of [staffHelperSrc, jobsHelperSrc]) assert.doesNotMatch(src, /from '\.\.\/(?:staff|jobs)\//)
})

test('接单人按端给按钮：文档打开、压缩包发到聊天或保存到电脑、H5 下载，都能复制链接', () => {
  const zip = { kind: 'archive', openable: false }
  const pdf = { kind: 'doc', openable: true }
  const phone = { mp: true, desktop: false, canShare: true, canSave: false }
  const pc = { mp: true, desktop: true, canShare: true, canSave: true }
  const oldWechat = { mp: true, desktop: false, canShare: false, canSave: false }
  const h5 = { mp: false }
  assert.deepEqual(jobs.fileActions(pdf, phone), ['打开', '复制下载链接'])
  assert.deepEqual(jobs.fileActions(zip, phone), ['发到微信聊天', '复制下载链接'])
  assert.deepEqual(jobs.fileActions(zip, pc), ['保存到电脑', '复制下载链接'])
  assert.deepEqual(jobs.fileActions(pdf, pc), ['打开', '保存到电脑', '复制下载链接'])
  assert.deepEqual(jobs.fileActions(zip, oldWechat), ['复制下载链接'])
  assert.deepEqual(jobs.fileActions(zip, h5), ['下载', '复制下载链接'])
  assert.deepEqual(jobs.fileActions(pdf, h5), ['下载', '复制下载链接'])
  // 转发到聊天前下载到小程序自己的目录，文件名带扩展名；转发 / 取消后删掉临时文件
  assert.match(jobsHelperSrc, /wx\.env\.USER_DATA_PATH \+ '\/omat_' \+ f\.fileId \+ '\.' \+ f\.ext/)
  assert.match(jobsHelperSrc, /wx\.shareFileMessage\(\{\s*filePath: local,\s*fileName: f\.name/)
  assert.match(deliver, /小程序里打不开压缩包：可以发到微信「文件传输助手」/)
})

test('交付页和交付记录：退回原因保留换行、长的先折叠，截图可以点开看', () => {
  assert.match(deliver, /x\.reviewImages/)
  assert.match(deliver, /preview\(x\.reviewImages, shotIndex\)/)
  assert.match(deliver, /\.review__text \{[^}]*white-space: pre-wrap/)
  assert.match(deliver, /copyReason\(x\.comment\)/)
  assert.match(onlineJobs, /latestShots = computed\(\(\) => \(latest\.value && latest\.value\.reviewImages\) \|\| \[\]\)/)
  assert.match(onlineJobs, /\.review-text \{[^}]*white-space: pre-wrap/)
  assert.match(onlineJobs, /fold\(latest\.comment, 40\)/, '验收屏的「当前状态」只显示前 40 字')
  // 截图上传中不能确认退回；弹窗内容在 scroll-view 里滚（遮罩挡住了页面的 touchmove）
  assert.match(onlineJobs, /if \(returnUploading\.value\) \{ reviewError\.value = '截图还在上传，请稍候'; return \}/)
  assert.equal((onlineJobs.match(/<scroll-view scroll-y class="panel-scroll">/g) || []).length, 2)
})

test('大文件（超过 8MB）分段上传：先登记、按顺序每段 8MB、网络抖动重试同一段、最后核对；业务拒收不重试、失败时放弃这次上传', async () => {
  const MB = 1024 * 1024
  const run = async (size, fail) => {
    const calls = []
    const reads = []
    let tries = 0
    const call = async (method, url, data) => {
      calls.push([method, url.replace(/^.*\/material-files/, ''), data instanceof ArrayBuffer ? data.byteLength : data])
      if (url.endsWith('/parts') && method === 'POST') return { uploadId: 'a'.repeat(32), partBytes: 8 * MB, parts: Math.ceil(size / (8 * MB)) }
      if (fail && /\/parts\/a+\/1$/.test(url)) { tries++; const e = new Error(fail.msg); e.retry = fail.retry; if (!fail.once || tries === 1) throw e }
      if (url.endsWith('/finish')) return { fileId: 9, name: '六张原图.zip' }
      return {}
    }
    const read = async (f, start, len) => { reads.push([start, len]); return new ArrayBuffer(len) }
    const pct = []
    let out = null, err = null
    try { out = await staff.uploadInParts(7, { name: '六张原图.zip', size, path: 'x' }, (n) => pct.push(n), call, read) } catch (e) { err = e }
    return { calls, reads, pct, out, err, tries }
  }
  // 35MB：5 段（4 段 8MB + 最后 3MB），按顺序传，最后 finish
  const ok = await run(35 * MB)
  assert.deepEqual(ok.calls[0], ['POST', '/parts', { name: '六张原图.zip', size: 35 * MB }])
  assert.deepEqual(ok.reads, [[0, 8 * MB], [8 * MB, 8 * MB], [16 * MB, 8 * MB], [24 * MB, 8 * MB], [32 * MB, 3 * MB]])
  assert.deepEqual(ok.calls.slice(1, 6).map((c) => c[1] + ':' + c[2]), [0, 1, 2, 3, 4].map((i) => '/parts/' + 'a'.repeat(32) + '/' + i + ':' + (i < 4 ? 8 * MB : 3 * MB)))
  assert.equal(ok.calls[6][1], '/parts/' + 'a'.repeat(32) + '/finish')
  assert.deepEqual(ok.out, { fileId: 9, name: '六张原图.zip' })
  assert.deepEqual(ok.pct, [20, 40, 60, 80, 99, 100])
  // 网络断一下：同一段再试一次就过
  const flaky = await run(20 * MB, { msg: '网络连接失败，请检查网络后重试', retry: true, once: true })
  assert.equal(flaky.err, null)
  assert.equal(flaky.tries, 2)
  // 一直断：试 3 次后放弃，并告诉服务端删掉已收的部分
  const down = await run(20 * MB, { msg: '网络连接失败，请检查网络后重试', retry: true })
  assert.equal(down.tries, 3)
  assert.equal(down.err.message, '网络连接失败，请检查网络后重试')
  assert.deepEqual(down.calls.at(-1).slice(0, 2), ['DELETE', '/parts/' + 'a'.repeat(32)])
  // 服务端拒收（比如上传已失效）：不重试，直接把原因交给页面
  const refused = await run(20 * MB, { msg: '这次上传已失效，请重新添加这个文件', retry: false })
  assert.equal(refused.tries, 1)
  assert.equal(refused.err.message, '这次上传已失效，请重新添加这个文件')
  // 8MB 以内的照旧整个传（uploadFile），超过的才分段
  assert.match(staffHelperSrc, /if \(Number\(f && f\.size\) > PART_BYTES\) return uploadInParts\(appId, f, onProgress\)/)
  // 小程序按位置读本地文件，网页用 File.slice；分段请求按原始字节发
  assert.match(staffHelperSrc, /readFile\(\{ filePath: f\.path, position: start, length,/)
  assert.match(staffHelperSrc, /f\.file\.slice\(start, start \+ length\)/)
  assert.match(staffHelperSrc, /'application\/octet-stream'/)
  // 小程序 readFile 读出的 ArrayBuffer 来自另一个运行环境（instanceof 是 false，模拟器实测），按类型标签认
  assert.equal(staff.isBinary(new ArrayBuffer(3)), true)
  assert.equal(staff.isBinary({ [Symbol.toStringTag]: 'ArrayBuffer', byteLength: 3 }), true)
  assert.equal(staff.isBinary({ name: 'a.zip' }), false)
  assert.doesNotMatch(staffHelperSrc, /data instanceof ArrayBuffer/)
})

test('分段上传的接口和后端映射一致，后端按顺序收段、传完核对文件头、配额先按申报大小查', () => {
  assert.match(staffCtl, /@PostMapping\("\/assignments\/\{appId\}\/material-files\/parts"\)/)
  assert.match(staffCtl, /@PostMapping\("\/assignments\/\{appId\}\/material-files\/parts\/\{uploadId\}\/\{index:\[0-9\]\{1,4\}\}"\)/)
  assert.match(staffCtl, /@PostMapping\("\/assignments\/\{appId\}\/material-files\/parts\/\{uploadId\}\/finish"\)/)
  assert.match(staffCtl, /@DeleteMapping\("\/assignments\/\{appId\}\/material-files\/parts\/\{uploadId\}"\)/)
  assert.match(staffHelperSrc, /base \+ '\/parts\/' \+ id \+ '\/' \+ i, buf/)
  assert.match(staffHelperSrc, /base \+ '\/parts\/' \+ id \+ '\/finish'/)
  // 开始时按申报的大小先查配额，传完按实际大小再查
  assert.match(materialJava, /quota\(c, appId, bytes\);\s+return files\.partBegin/)
  assert.match(materialJava, /quota\(c, appId, a\.checked\.size\);/)
  assert.match(filesJava, /if \(index > expected\)/)
  assert.match(filesJava, /checkHead\(p\.ext, in\);/)
})
