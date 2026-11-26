// 2026-10-16 第二轮改版：岗位筛选条件（V48 性别偏好 / 休息排班 / 住宿房型）的后端约定静态回归（node --test，不需要构建、不发请求）。
// 守住这几件事：
//   · GET /app/job/list 认 cities / gender / restModes / roomTypes / skills / assured（小程序岗位列表的筛选面板按这些名字传）；
//   · 排班、房型、性别的取值只有一份口径（后端 JobFilterFields），后台岗位表单的下拉、小程序筛选面板的选项都在白名单里；
//   · 后台岗位表单：性别只给换工换宿、排班只给线下岗位、房型只在包住时显示，超出范围的提交空串；
//   · 技能需求的四个选项（做饭 / 拍摄 / 开车 / 玩游戏）在技能词典 KgSkills 和门店关键词 DUTY 里都有；
//   · V48 迁移和回退脚本在，统一 LF，查询列和后端启动核对（JobFilterFieldsSchema）对得上。
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile, access } from 'node:fs/promises'

const read = async (p) => (await readFile(new URL(p, import.meta.url), 'utf8')).replace(/\r\n/g, '\n')
const raw = async (p) => readFile(new URL(p, import.meta.url), 'utf8')
const exists = async (p) => access(new URL(p, import.meta.url)).then(() => true, () => false)
const javaRoot = '../../RuoYi-Vue/ruoyi-kangaroo/src/main/java/com/ruoyi/kangaroo/'
const jobCtl = await read(javaRoot + 'controller/app/AppJobController.java')
const fields = await read(javaRoot + 'domain/JobFilterFields.java')
const skills = await read(javaRoot + 'ext/user/KgSkills.java')
const staffJava = await read(javaRoot + 'ext/staff/KgStaffJobService.java')
const keywordJava = await read(javaRoot + 'ext/user/KgJobKeyword.java')
const mapper = await read('../../RuoYi-Vue/ruoyi-kangaroo/src/main/resources/mapper/kangaroo/KgJobMapper.xml')
const schema = await read(javaRoot + 'config/schema/JobFilterFieldsSchema.java')
const admin = await read('../../RuoYi-Vue3/src/views/kangaroo/job/index.vue')

/** JobFilterFields 里 static 块的 X.put("code", "label") */
const javaMap = (varName) => {
  const block = fields.slice(fields.indexOf('static\n    {'), fields.indexOf('MIN_DAYS_MAX'))
  const part = block.slice(block.indexOf(`Map<String, String> ${varName} = new LinkedHashMap`))
  const end = part.indexOf('Collections.unmodifiableMap')
  return [...part.slice(0, end).matchAll(/\.put\("([^"]+)", "([^"]+)"\)/g)].map(m => [m[1], m[2]])
}
const REST = javaMap('r')
const ROOM = javaMap('t')
const GENDER = javaMap('g')

test('列表接口认筛选面板的参数名', () => {
  for (const p of ['cities', 'gender', 'restModes', 'roomTypes', 'skills', 'assured', 'minStay', 'keyword', 'city', 'skill']) {
    assert.match(jobCtl, new RegExp(`@RequestParam\\(required = false\\) \\w+ ${p}[,)]`), p)
  }
  assert.match(jobCtl, /static final int MAX_CITIES = 5;/)
  assert.match(jobCtl, /static final int MAX_SKILLS = 8;/)
  // 出参：排班、房型带文案，认证和保险每类岗位都下发
  for (const k of ['genderPref', 'restMode', 'restModeLabel', 'roomType', 'roomTypeLabel', 'minDays', 'safeCert', 'insuranceFlag', 'assured']) {
    assert.match(jobCtl, new RegExp(`m\\.put\\("${k}"`), k)
  }
})

test('排班 / 房型 / 性别只有一份取值口径', () => {
  assert.deepEqual(REST, [['1-1', '做一休一'], ['4-3', '做四休三'], ['2-1', '做二休一'], ['5-2', '做五休二'], ['3-2', '做三休二'], ['3-1', '做三休一'], ['6-1', '做六休一']])
  assert.deepEqual(ROOM, [['single', '单人间'], ['double', '双人间'], ['triple', '三人间'], ['multi', '多人间']])
  assert.deepEqual(GENDER, [['F', '女'], ['M', '男']])
  // 后台表单的下拉和后端同一套
  const opts = (name) => {
    const m = new RegExp(`const ${name} = (\\[[\\s\\S]*?\\])\\n`).exec(admin)
    assert.ok(m, name)
    return Function('return (' + m[1] + ')')().map(o => [o.value, o.label])
  }
  assert.deepEqual(opts('REST_MODE_OPTIONS'), REST)
  assert.deepEqual(opts('ROOM_TYPE_OPTIONS'), ROOM)
  assert.deepEqual(opts('GENDER_OPTIONS'), GENDER)
})

test('后台岗位表单：性别只给换工、排班只给线下、房型只在包住时，超出范围提交空串', () => {
  assert.match(admin, /<el-col :span="12" v-if="form\.jobType === 'volunteer'">\s*<el-form-item label="性别偏好" prop="genderPref">/)
  assert.match(admin, /<el-col :span="12" v-if="!isOnline">\s*<el-form-item label="休息排班" prop="restMode">/)
  assert.match(admin, /<el-col :span="12" v-if="hasHousing">\s*<el-form-item label="住宿条件" prop="roomType">/)
  assert.match(admin, /form\.value\.jobType === 'volunteer'\n  \|\| \(form\.value\.jobType !== 'online' && \(form\.value\.boardType === 'all' \|\| form\.value\.boardType === 'room'\)\)/)
  assert.match(admin, /genderPref: "", genderCountsEnabled: false, genderMaleCount: null, genderFemaleCount: null,\n    restMode: "",\n    roomType: "",/)
  assert.match(admin, /form\.value\.genderPref = form\.value\.jobType === "volunteer" \? \(form\.value\.genderPref \|\| ""\) : ""/)
  assert.match(admin, /form\.value\.restMode = form\.value\.jobType !== "online" \? \(form\.value\.restMode \|\| ""\) : ""/)
  assert.match(admin, /form\.value\.roomType = hasHousing\.value \? \(form\.value\.roomType \|\| ""\) : ""/)
})

test('技能需求的四个选项：技能词典和门店关键词里都有', () => {
  const dict = Object.fromEntries([...skills.matchAll(/DICT\.put\("([^"]+)", new String\[\] \{ ([^}]*) \}\);/g)]
    .map(m => [m[1], [...m[2].matchAll(/"([^"]+)"/g)].map(x => x[1]).slice(2)]))
  assert.deepEqual(dict['做饭'], ['做饭', '厨', '烹饪', '下厨'])
  assert.deepEqual(dict['开车'], ['开车', '驾照', '驾驶', '司机'])
  assert.deepEqual(dict['玩游戏'], ['游戏', '剧本杀', '桌游'])
  assert.ok(dict['摄影'].includes('拍摄'), '拍摄是摄影的同义词')
  for (const k of ['做饭', '拍摄', '开车', '玩游戏']) assert.match(staffJava, new RegExp(`DUTY\\.put\\("${k}", "[^"]+"\\);`), k)
  // 门店发布写进四个新列
  for (const c of ['gender_pref', 'rest_mode', 'room_type', 'min_days']) assert.match(staffJava, new RegExp(`row\\.put\\("${c}"`), c)
})

test('小程序筛选面板的取值都在后端白名单里（文件还在时）', async () => {
  if (!(await exists('../pages/jobs/job-filters.js'))) return
  const src = await read('../pages/jobs/job-filters.js')
  const values = (name) => {
    const m = new RegExp(`export const ${name} = (\\[[^\\n]*\\])\\n`).exec(src)
    return m ? Function('return (' + m[1] + ')')().map(o => o[1]) : null
  }
  const rest = values('REST_OPTS'), room = values('ROOM_OPTS'), gender = values('GENDER_OPTS')
  if (rest) for (const v of rest) assert.ok(REST.some(r => r[0] === v), v)
  if (room) for (const v of room) assert.ok(ROOM.some(r => r[0] === v), v)
  if (gender) for (const v of gender.filter(Boolean)) assert.ok(GENDER.some(r => r[0] === v), v)
  const skillKeys = [...skills.matchAll(/DICT\.put\("([^"]+)"/g)].map(m => m[1])
  for (const name of ['SKILL_BASE', 'SKILL_MORE']) {
    const vs = values(name)
    if (vs) for (const v of vs) assert.ok(skillKeys.includes(v) || skills.includes(`"${v}"`), v + ' 不在 KgSkills 词典里')
  }
})

test('mapper：三列查得出、能写，筛选条件走参数绑定', () => {
  assert.match(mapper, /j\.gender_pref, j\.rest_mode, j\.room_type,/)
  for (const [p, c] of [['genderPref', 'gender_pref'], ['restMode', 'rest_mode'], ['roomType', 'room_type']]) {
    assert.match(mapper, new RegExp(`<result property="${p}"\\s+column="${c}"\\s*/>`), p)
    assert.equal(mapper.split(`<if test="${p} != null">${c} = #{${p}},</if>`).length - 1, 2, p + ' 局部更新 + 后台整表单更新')
  }
  assert.match(mapper, /and j\.gender_pref in \('', #\{params\.gender\}\)/)
  assert.match(mapper, /and j\.rest_mode in\s*<foreach item="rm" collection="params\.restModes"/)
  assert.match(mapper, /and j\.room_type in\s*<foreach item="rt" collection="params\.roomTypes"/)
  // 代招用实际招聘门店的认证状态，自招才读发布门店。
  assert.match(mapper, /<if test="params\.assured == true"> and j\.job_type &lt;&gt; 'online' and j\.insurance_flag = '0' and \(case when j\.recruit_store_id is null then s\.safe_cert else rs\.safe_cert end\) = '0'<\/if>/)
  assert.match(mapper, /<foreach item="kt" collection="params\.keywordTerms">/)
  const fragments = [...mapper.matchAll(/\$\{([^}]+)\}/g)].map(m => m[1]).sort()
  assert.deepEqual(fragments, ['jobDisplayOrder', 'jobEffectiveUrgency'], '仅允许后端静态排序片段')
  for (const [name, method] of [['jobDisplayOrder', 'sql'], ['jobEffectiveUrgency', 'effectiveUrgency']]) {
    assert.ok(mapper.includes(`<bind name="${name}" value="@com.ruoyi.kangaroo.ext.user.KgJobDisplayOrder@${method}()"/>`))
  }
  // 关键词规则写在 KgJobKeyword 的注释里（文档就是代码）
  for (const w of ['海边', '一二线', '小众', '安静', '风景']) assert.ok(keywordJava.includes(`"${w}"`), w)
})

test('V48 迁移、回退脚本在，统一 LF；启动核对查的就是这三列', async () => {
  const m = await raw('../../RuoYi-Vue/sql/kangaroo/V48__job_filter_fields.sql')
  const r = await raw('../../RuoYi-Vue/sql/kangaroo/V48__rollback.sql')
  assert.ok(!m.includes('\r\n') && !r.includes('\r\n'))
  assert.match(m, /call kg_assert_env\('47'\);/)
  assert.match(m, /values \(48, 'job_filter_fields', now\(\), '[0-9a-f]{64}'\)/)
  assert.match(r, /@kg_allow_job_filter_fields_rollback/)
  assert.match(schema, /V48__job_filter_fields\.sql/)
  for (const c of ['gender_pref', 'rest_mode', 'room_type']) {
    assert.match(m, new RegExp(`call kg_add_col_if_absent\\('kg_job', '${c}'`), c)
    assert.match(schema, new RegExp(`column_name = '${c}'`), c)
  }
})
