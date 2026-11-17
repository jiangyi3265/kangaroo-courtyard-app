// 私信放宽 + 门店会话发文件（V46，2026-10-16 主人真机反馈）的静态回归（node --test，不构建、不发请求）。
// 守住这几件事：
//   · 前后端上限一致：文字 2000 字、图片 20MB、文件 10MB、同一份白名单（zip / rar / 7z / PDF / Word / Excel / PPT）；
//   · 前端调的接口和后端映射一致（发文件、带令牌下载、复制链接、匿名签名链接）；
//   · 文件逻辑放在 community 分包目录里的 chat-files.js，不引用别的分包的模块（否则 uni-app 会把它挪进主包）；
//   · 点文件卡片按端给选项：文档「打开」、压缩包「发到微信聊天」/「保存到电脑」、网页版「下载」，都能「复制下载链接」；
//   · 旧版本小程序看到的是文字「[文件] 名称，请升级小程序查看」；
//   · 进度页：专员发布的线上任务按钮叫「联系专员」。
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

const read = async (p) => (await readFile(new URL(p, import.meta.url), 'utf8')).replace(/\r\n/g, '\n')
const javaRoot = '../../RuoYi-Vue/ruoyi-kangaroo/src/main/java/com/ruoyi/kangaroo/'
const chatJava = await read(javaRoot + 'ext/community/KgChatService.java')
const filesJava = await read(javaRoot + 'ext/community/KgChatFiles.java')
const imageJava = await read(javaRoot + 'ext/community/KgChatImage.java')
const materialJava = await read(javaRoot + 'ext/staff/KgOnlineMaterialFiles.java')
const chatCtl = await read(javaRoot + 'controller/app/AppTripChatController.java')
const fileCtl = await read(javaRoot + 'controller/KgPrivateFileController.java')
const appCtl = await read(javaRoot + 'controller/app/AppApplicationController.java')
const chat = await read('../pages/community/chat.vue')
const progress = await read('../pages/jobs/progress.vue')
const helperSrc = await read('../pages/community/chat-files.js')
const mediaSrc = await read('../common/chat-media.js')
const files = await import('../pages/community/chat-files.js')

test('前后端上限一致：文字 2000、图片 20MB、文件 10MB、同一份白名单', () => {
  assert.match(chatJava, /static final int TEXT_MAX = 2000;/)
  assert.match(chat, /const CHAT_TEXT_MAX = 2000/)
  assert.match(imageJava, /public static final int MAX=20\*1024\*1024;/)
  assert.match(mediaSrc, /export const CHAT_IMAGE_MAX = 20 \* 1024 \* 1024/)
  assert.match(chat, /file\?\.size>20\*1024\*1024\)return toast\('请选择不超过20MB的图片'\)/)
  // 2026-10-16：素材附件分段上传到 100MB，聊天文件仍整个传，上限还是 Spring multipart 的 10MB（DIRECT_MAX_BYTES）
  assert.match(materialJava, /public static final long DIRECT_MAX_BYTES = 10L \* 1024 \* 1024;/)
  assert.match(filesJava, /MAX_BYTES = KgOnlineMaterialFiles\.DIRECT_MAX_BYTES;/)
  assert.equal(files.MAX_FILE_MB, 10)
  const javaExts = /KEY_PATTERN = "chat\/\[1-9\]\[0-9\]\{0,18\}\/\[0-9a-f\]\{32\}\\\\\.\(([a-z0-9|]+)\)"/.exec(filesJava)?.[1]
  assert.deepEqual(files.FILE_EXTS, javaExts.split('|'))
  assert.equal(files.TYPE_HINT, /TYPE_HINT = "([^"]+)"/.exec(materialJava)[1])
})

test('前端调的接口和后端映射一致', () => {
  assert.match(chatCtl, /@PostMapping\("\/chat\/\{convId\}\/files"\)/)
  assert.match(chatCtl, /@GetMapping\("\/chat\/\{convId\}\/messages\/\{msgId\}\/file"\)/)
  assert.match(chatCtl, /@GetMapping\("\/chat\/\{convId\}\/messages\/\{msgId\}\/file\/link"\)/)
  assert.match(fileCtl, /@Anonymous\s+@GetMapping\("\/kangaroo\/file\/chat"\)/)
  assert.match(filesJava, /return "\/kangaroo\/file\/chat\?m=" \+ msgId \+ "&u=" \+ uid/)
  assert.equal(files.filePath(12, 73), '/app/chat/12/messages/73/file')
  assert.match(helperSrc, /url: API_BASE \+ '\/app\/chat\/' \+ convId \+ '\/files'/)
  assert.match(helperSrc, /formData: \{ name: f\.name, clientMessageId \}/)
  assert.match(helperSrc, /get\(filePath\(convId, msgId\) \+ '\/link'\)/)
  // 小程序从聊天记录里选、网页版本机选；一次一个
  assert.match(helperSrc, /wx\.chooseMessageFile\(\{\s*count: 1, type: 'file', extension: FILE_EXTS/)
  assert.match(helperSrc, /uni\.chooseFile\(\{\s*count: 1/)
})

test('文件逻辑留在 community 分包，不引用别的分包', () => {
  assert.match(chat, /from '\.\/chat-files\.js'/)
  // 只看 import 语句（注释里会提到那两份素材附件的模块）
  for (const src of [chat, helperSrc]) {
    const imports = src.split(/\n/).filter((l) => /^\s*import\s/.test(l)).join(' ')
    assert.ok(imports.length > 0)
    assert.doesNotMatch(imports, /pages\/jobs\/|pages\/staff\/|material-files|online-material/)
  }
  assert.doesNotMatch(helperSrc, /from '\.\.\/\.\.\/pages/)
})

test('本机先挡掉格式不对、超过 10MB 的文件', () => {
  assert.equal(files.fileProblem({ name: '报名材料.PDF', size: 1024 }), '')
  assert.equal(files.fileProblem({ name: '作品集.7z', size: 10 * 1024 * 1024 }), '')
  assert.equal(files.fileProblem({ name: '安装包.exe', size: 10 }), files.TYPE_HINT)
  assert.match(files.fileProblem({ name: '原图.zip', size: 10 * 1024 * 1024 + 1 }), /超过 10MB/)
  assert.equal(files.fileProblem(null), '没有选到文件')
  assert.equal(files.extOf('合同 v2.DOCX'), 'docx')
  assert.equal(files.extOf('没有扩展名'), '')
  assert.equal(files.sizeLabel(512), '512 B')
  assert.equal(files.sizeLabel(1536), '1.5 KB')
  assert.equal(files.sizeLabel(10 * 1024 * 1024), '10 MB')
  assert.equal(files.sizeLabel(150 * 1024), '150 KB')
})

test('上传回包：非 200 一律失败并带上服务端原因和错误码；413 说清大小', () => {
  assert.deepEqual(files.parseUpload({ statusCode: 200, data: '{"code":200,"data":{"msgId":73}}' }), { data: { msgId: 73 } })
  assert.deepEqual(files.parseUpload({ statusCode: 200, data: { code: 422, msg: '只有和门店的沟通里可以发文件' } }), { error: '只有和门店的沟通里可以发文件', code: 422 })
  assert.equal(files.parseUpload({ statusCode: 413, data: '' }).error, '文件太大了，单个不能超过 10MB')
  assert.equal(files.parseUpload({ statusCode: 502, data: '<html>' }).error, '文件发送结果无法确认，请重试')
})

test('点文件卡片按端给选项', () => {
  const doc = { openable: true }, zip = { openable: false }
  const h5 = { mp: false }
  const phone = { mp: true, desktop: false, canShare: true, canSave: false }
  const pc = { mp: true, desktop: true, canShare: true, canSave: true }
  const oldWechat = { mp: true, desktop: false, canShare: false, canSave: false }
  assert.deepEqual(files.fileActions(doc, h5), ['下载', '复制下载链接'])
  assert.deepEqual(files.fileActions(doc, phone), ['打开', '复制下载链接'])
  assert.deepEqual(files.fileActions(zip, phone), ['发到微信聊天', '复制下载链接'])
  assert.deepEqual(files.fileActions(zip, pc), ['保存到电脑', '复制下载链接'])
  assert.deepEqual(files.fileActions(doc, pc), ['打开', '保存到电脑', '复制下载链接'])
  assert.deepEqual(files.fileActions(zip, oldWechat), ['复制下载链接'])
  // 页面按这些选项分别处理
  for (const act of ['复制下载链接', '发到微信聊天', '保存到电脑']) assert.ok(chat.includes(`act === '${act}'`), act)
  assert.match(chat, /else await downloadDoc\(path, f\.ext, f\.name\)/)
})

test('旧版本小程序看到的文字、会话列表里的文字', () => {
  assert.match(filesJava, /return "\[文件\] " \+ \(name == null \? "" : name\);/)
  assert.match(filesJava, /return preview\(name\) \+ "，请升级小程序查看";/)
  assert.match(chatJava, /v\.put\("content", file \? KgChatFiles\.fallback\(str\(r\.get\("fileName"\)\)\) : content\);/)
  assert.match(chatJava, /v\.put\("type", image \? "image" : file \? "file" : "text"\);/)
})

test('进度页：专员发布的线上任务叫「联系袋鼠工作人员」，其他「联系当地主理人」（2026-11-03 统一叫法）', () => {
  assert.match(appCtl, /data\.put\("contactSpecialist", jobRow != null && "online"\.equals\(jobRow\.get\("jobType"\)\)/)
  assert.match(progress, /const contactLabel = computed\(\(\) => \(contactSpecialist\.value \? '联系袋鼠工作人员' : '联系当地主理人'\)\)/)
  assert.match(progress, /@click="contactOwner">\{\{ contactLabel \}\}<\/k-button>/)
  assert.match(progress, /\{ icon: 'message-circle', text: contactLabel\.value, fn: \(\) => contactOwner\(\) \}/)
  assert.match(progress, /ONLINE_TIPS\.map\(\(t\) => \(\{ \.\.\.t, text: t\.text\.replace\('联系当地主理人', contactLabel\.value\) \}\)\)/)
})
