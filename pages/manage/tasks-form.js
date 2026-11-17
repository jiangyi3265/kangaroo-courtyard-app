// 门店任务（pages/manage/tasks.vue）发布表单与验收面板的纯逻辑（2026-11-03 主人：简化门店任务的发布与验收，一张表直接填、一个面板一次验完）。
// 放 manage 分包，不进主包，不引 @/，node --test 直接跑（scripts/F-store-tasks-simplify-20261103.test.mjs）。
// 提交给服务端的字段和接口一项没变：发布照旧 POST /app/manage/tasks（taskPayload），验收照旧 POST /app/manage/tasks/{id}/check（checkPayload）。
// 文件名不能叫 tasks.js：和页面同名会被打到包根目录、算进主包（见 merchant-app-20261030.test.mjs）。

export const TITLE_MAX = 64
export const DESC_MAX = 300
export const ROLE_MAX = 32
export const SCOPE_MAX = 6
export const PLACE_MAX = 64
export const SKILL_MAX = 5
export const SKILL_LEN = 12
export const ACCEPT_MAX = 300
export const NOTE_MAX = 300
export const HOURS_MIN = 0.5
export const HOURS_MAX = 12
export const HOURS_STEP = 0.5
export const QUOTA_MIN = 1
export const QUOTA_MAX = 50
export const STAFF_MAX = 5
export const CHECK_HOURS_MIN = 0.5
export const CHECK_HOURS_MAX = 24
export const CHECK_COMMENT_MAX = 200
export const CHECK_PROOF_MAX = 6

// 优先级：三个平排的方块（原来是菜单里再弹一层菜单）
export const PRIORITIES = [['高', 'high'], ['中', 'medium'], ['低', 'low']]
// 分配方式：两个方块
export const MODES = [['指定员工', 'staff'], ['开放给换工', 'volunteer']]
// 验收的星：1–5 星各一句话，年纪大的人看字不看星
export const RATING_LABELS = ['', '很差', '较差', '一般', '很好', '非常好']

const clean = (v) => String(v == null ? '' : v).trim()
const count = (s) => Array.from(clean(s)).length

// ---------------------------------------------------------------- 发布表单

/** 空表单。taskDate 由页面按「明天」传进来（ui.js 的 shiftDate / todayCn 在主包，这里不引） */
export const blankTask = (taskDate = '') => ({
  taskId: null, title: '', description: '', roleName: '', scopeText: '', place: '', priority: 'medium', taskDate,
  startTime: '13:00', endTime: '17:00', estHours: 4, skills: [], mode: 'volunteer', quota: 5, assignees: [], assigneeNames: [], acceptRule: '', note: ''
})

/** 「用；分隔、或一行一条」的职责范围 → 数组（去空、最多 6 条）。和原来弹窗里输入的规则一样 */
export const splitScope = (text) => clean(text).split(/[;；\n]/).map(x => x.trim()).filter(Boolean).slice(0, SCOPE_MAX)

/** 服务端任务详情 → 表单（编辑草稿）。规则同原来的 fillForm：缺原始日期时报错，已取消的人不带回 */
export function formFromTask(d, fallbackDate = '') {
  if (!d.taskDate || !d.startTime || !d.endTime) throw new Error('任务详情缺少原始日期，请刷新后再编辑')
  const people = (d.assignees || []).filter(a => a.status !== 'cancelled')
  return {
    ...blankTask(fallbackDate), taskId: d.taskId, title: d.title, description: d.description || '', roleName: d.editRoleName || '',
    scopeText: (d.scope || []).join('；'), place: d.editPlace || '',
    taskDate: String(d.taskDate).slice(0, 10), startTime: String(d.startTime).slice(0, 5), endTime: String(d.endTime).slice(0, 5),
    estHours: Number(d.estHours), priority: d.priority, assignees: people.map(a => a.userId), assigneeNames: people.map(a => a.nickname || '用户' + a.userId),
    skills: d.skills || [], mode: d.assignMode || 'staff', quota: d.quota || 1, acceptRule: d.acceptRule || '', note: d.editNote || ''
  }
}

/** 提交给服务端的内容：字段名、取值和改版前一模一样 */
export function taskPayload(f, storeId, publish) {
  return {
    taskId: f.taskId, storeId: storeId || undefined, title: clean(f.title).slice(0, TITLE_MAX), description: clean(f.description).slice(0, DESC_MAX), roleName: clean(f.roleName).slice(0, ROLE_MAX),
    scope: splitScope(f.scopeText), place: clean(f.place).slice(0, PLACE_MAX), priority: f.priority, taskDate: f.taskDate, startTime: f.startTime, endTime: f.endTime, estHours: Number(f.estHours),
    skills: f.skills, assignMode: f.mode, quota: Number(f.quota), assignees: f.assignees, acceptRule: clean(f.acceptRule).slice(0, ACCEPT_MAX), note: clean(f.note).slice(0, NOTE_MAX), publish: !!publish
  }
}

/** 还差什么：键 → 一句话。存草稿只要标题；发布时指定员工要有人、时间要前后合理 */
export function taskErrors(f, publish) {
  const e = {}
  if (!clean(f.title)) e.title = '任务标题'
  else if (count(f.title) > TITLE_MAX) e.title = '任务标题（太长了）'
  if (count(f.description) > DESC_MAX) e.description = '任务说明（太长了）'
  if (count(f.roleName) > ROLE_MAX) e.roleName = '任务身份（太长了）'
  if (count(f.place) > PLACE_MAX) e.place = '地点（太长了）'
  if (count(f.acceptRule) > ACCEPT_MAX) e.acceptRule = '验收标准（太长了）'
  if (count(f.note) > NOTE_MAX) e.note = '补充说明（太长了）'
  if (!f.taskDate) e.taskDate = '任务日期'
  if (f.startTime && f.endTime && f.endTime <= f.startTime) e.endTime = '结束时间（要晚于开始时间）'
  if (publish && f.mode === 'staff' && !(f.assignees || []).length) e.assignees = '指定员工'
  return e
}
export const TASK_ERR_ORDER = ['title', 'description', 'roleName', 'place', 'taskDate', 'endTime', 'assignees', 'acceptRule', 'note']
export const taskErrKeys = (f, publish) => { const e = taskErrors(f, publish); return TASK_ERR_ORDER.filter(k => e[k]) }
/** 底栏那一行字：一直写着还差什么，不等点了提交才知道 */
export function taskTodoText(f, publish) {
  const e = taskErrors(f, publish)
  const names = TASK_ERR_ORDER.filter(k => e[k]).map(k => e[k])
  if (!names.length) return publish ? '都填好了，可以发布' : '填好标题就能存草稿'
  return '还差：' + names.join('、')
}

/** 预估工时加减：0.5–12，步长 0.5 */
export const stepHours = (h, dir) => Math.min(HOURS_MAX, Math.max(HOURS_MIN, Math.round((Number(h) || HOURS_MIN) * 2 + dir) / 2))
/** 换工名额加减：1–50 */
export const stepQuota = (q, dir) => Math.min(QUOTA_MAX, Math.max(QUOTA_MIN, (Number(q) || QUOTA_MIN) + dir))

/** 加一个技能：返回 { skills } 或 { error }。规则同原来：12 字以内、最多 5 个、不重复 */
export function addSkill(skills, text) {
  const v = clean(text).slice(0, SKILL_LEN)
  if (!v) return { error: '先写上技能名' }
  if (skills.length >= SKILL_MAX) return { error: '最多 ' + SKILL_MAX + ' 个技能' }
  if (skills.includes(v)) return { error: '这个技能已经有了' }
  return { skills: [...skills, v] }
}
export const removeSkill = (skills, index) => skills.filter((_, k) => k !== index)

const WEEK = ['日', '一', '二', '三', '四', '五', '六']
/** 任务日期那一行显示的字：11月5日（周三） */
export function taskDateText(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd || '')
  if (!m) return '请选择'
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日（周${WEEK[d.getUTCDay()]}）`
}

// ---------------------------------------------------------------- 验收面板

/** 任务详情的 timeText 里写着预估工时（「… · 4小时」），验收时先填进去 */
export function estHoursOf(timeText) {
  const m = /([\d.]+)小时/.exec(timeText || '')
  return m ? Number(m[1]) : ''
}

/** 打开面板时的初始状态：只有一个进行中的人就直接选上 */
export function blankCheck(task) {
  const people = (task.assignees || []).filter(a => a.status === 'accepted').map(a => ({ userId: a.userId, name: a.nickname || '用户' + a.userId }))
  // 2026-11-03 复查：任务详情本身带 estHours 就直接用，timeText 里的「… · 4小时」只作兜底（原来只认 timeText）
  const est = Number(task.estHours)
  return { taskId: task.taskId, title: task.title, people, userId: people.length === 1 ? people[0].userId : null, hours: est > 0 ? est : estHoursOf(task.timeText), rating: 5, comment: '', proofs: [] }
}

/** 实际工时加减：0.5–24，步长 0.5（也能直接在框里打字，提交时再按同样的规则校验） */
export const stepCheckHours = (h, dir) => Math.min(CHECK_HOURS_MAX, Math.max(CHECK_HOURS_MIN, Math.round((Number(h) || CHECK_HOURS_MIN) * 2 + dir) / 2))

/** 验收面板还差什么 */
export function checkErrors(c) {
  const e = {}
  if (c.userId == null || c.userId === '') e.userId = '选一位接单人'
  const h = clean(c.hours)
  if (!h) e.hours = '实际工时'
  else if (!/^\d+(\.\d)?$/.test(h) || Number(h) < CHECK_HOURS_MIN || Number(h) > CHECK_HOURS_MAX) e.hours = '工时 0.5–24 小时，最多一位小数'
  if (!(c.rating >= 1 && c.rating <= 5)) e.rating = '点一下星'
  if (count(c.comment) > CHECK_COMMENT_MAX) e.comment = '评语不超过 200 字'
  return e
}
export function checkTodoText(c) {
  const e = checkErrors(c)
  const names = ['userId', 'hours', 'rating', 'comment'].filter(k => e[k]).map(k => e[k])
  return names.length ? '还差：' + names.join('、') : '都填好了，点「验收通过」'
}

/** 提交给服务端的内容：字段名、取值和改版前一模一样（hours 数字、rating 1–5、comment 去空格截 200、proofs 图片地址数组） */
export function checkPayload(c) {
  return { userId: c.userId, hours: Number(c.hours), rating: Number(c.rating), comment: clean(c.comment).slice(0, CHECK_COMMENT_MAX), proofs: c.proofs || [] }
}

/** 结算前那一次确认框的正文（积分一发就收不回，这一次确认保留） */
export function checkConfirmText(c) {
  const who = (c.people.find(p => String(p.userId) === String(c.userId)) || {}).name || '接单人'
  return `给 ${who} 记 ${Number(c.hours)} 小时、${c.rating} 星（${RATING_LABELS[c.rating]}）${c.proofs.length ? '，凭证 ' + c.proofs.length + ' 张' : ''}。验收通过后积分随即发放，不能撤回。`
}
