import test from 'node:test'
import assert from 'node:assert/strict'
import { parseActivityText } from '../common/activity-text.js'
import { parseRecruitmentText } from '../pages/staff/recruitment-text.js'

const today = '2026-11-21'

test('活动示例识别标题、人数、地点、收费和起止时刻', () => {
  assert.deepEqual(parseActivityText('海岛徒步，12月6日09:00到12:00，在码头集合，限12人，每人30元', today), {
    values: { title:'海岛徒步', place:'码头', people:12, feeKind:'paid', fee:'30' },
    schedule: { date:'2026-12-06', endDate:'2026-12-06', time:'09:00', endTime:'12:00' }
  })
})

test('连续多个字段、跨天、相对日期和截止时间分别填入', () => {
  const text = '活动名称：观星 活动地点：山顶 集合时间：明天20:00 结束时间：后天08:00 报名截止：今天中午11点 预计人数：8'
  assert.deepEqual(parseActivityText(text,today), {
    values:{title:'观星',place:'山顶',people:8},
    schedule:{date:'2026-11-22',time:'20:00',endDate:'2026-11-23',endTime:'08:00',deadlineDate:today,deadlineTime:'11:00'}
  })
})

test('自然时段与AA金额识别，非法日期与超限人数不回填', () => {
  const {values,schedule} = parseActivityText('明天下午2点半到4点，费用AA，每人12.50元',today)
  assert.equal(schedule.endTime,'16:00')
  assert.equal(schedule.time,'14:30')
  assert.deepEqual(values,{feeKind:'aa',aaFee:'12.50'})
  assert.deepEqual(parseActivityText('2月31日25:99，限1200人',today),{values:{},schedule:{}})
})

test('活动人数和费用区间不会冒充日期或单个值，时长和装备不算收费或人数', () => {
  for (const text of ['人数：8-12人，每人30-50元', '招募8到12人，费用：35至50', '自带2人帐篷，人均0.5小时', '人数：8人以上，费用：30元起，活动不免费']) {
    assert.deepEqual(parseActivityText(text, today), {values:{},schedule:{}})
  }
  assert.deepEqual(parseActivityText('活动名称：测试 人数：20 地点：南门 费用：30元', today).values,
    {title:'测试',people:20,place:'南门',feeKind:'paid',fee:'30'})
  assert.deepEqual(parseActivityText('每人30元，停车免费', today).values, {feeKind:'paid',fee:'30'})
  assert.deepEqual(parseActivityText('本次活动免费参加', today).values, {feeKind:'free'})
})

test('活动跨年、跨午夜、只有时刻的时间段分别按原文填写', () => {
  const expected = {date:'2026-12-31',time:'22:00',endDate:'2027-01-01',endTime:'01:15'}
  for (const text of ['12月31日22:00到1月1日01:15','开始时间：2026-12-31 22:00 结束时间：1月1日 01:15','12月31日22:00-01:15']) {
    assert.deepEqual(parseActivityText(text, today).schedule, expected)
  }
  assert.deepEqual(parseActivityText('08:10-11:20', today).schedule, {time:'08:10',endTime:'11:20'})
  assert.deepEqual(parseActivityText('集合时间：1月2日', today).schedule, {date:'2027-01-02'})
})

test('整段招聘启事能填标题、工时、薪资和福利', () => {
  assert.deepEqual(parseRecruitmentText('本店招聘民宿前台2人月薪5,000元，包吃包住，双休，每天8小时，负责接待客人，要求会英语'), {
    form:{headcount:2,salary:'5000',salaryType:'monthly',boardType:'all',restMode:'5-2',dailyHours:'每天 8 小时'},
    gen:{title:'民宿前台',work:'接待客人',hope:'会英语'}
  })
})

test('招聘识别只填明确的名额，保留岗位名，排班和食宿单独填写', () => {
  for (const text of ['招聘岗位：民宿前台，招聘人数：2至3人', '招民宿前台2-3名', '招民宿前台2.5人']) {
    assert.deepEqual(parseRecruitmentText(text), { form: {}, gen: { title: '民宿前台' } })
  }
  assert.deepEqual(parseRecruitmentText('要求服务过3位客人，上五休二，只包住'), {
    form: { restMode: '5-2', boardType: 'room' }, gen: { hope: '服务过3位客人' }
  })
  assert.deepEqual(parseRecruitmentText('招2人，工作内容：接待客人 地址：古城'), {
    form: { headcount: 2, address: '古城' }, gen: { work: '接待客人' }
  })
})

test('招聘文案里的否定福利和浮动工资不会被当作承诺', () => {
  assert.deepEqual(parseRecruitmentText('不包吃不包住，排班不保证双休，月薪5000元至￥7000元'), {
    form: {boardType:'none'}, gen: {}
  })
  assert.deepEqual(parseRecruitmentText('月薪：￥5000元起'), {form:{},gen:{}})
  assert.deepEqual(parseRecruitmentText('月薪：￥5000元，不是单休，做五休二'), {
    form:{salary:'5000',salaryType:'monthly',restMode:'5-2'}, gen:{}
  })
})

test('标注字段可连写，薪资范围不当作底薪，未知内容不覆盖已有字段', () => {
  assert.deepEqual(parseRecruitmentText('岗位名称：民宿管家 工作地点：古城 招聘人数：3 月薪：6k–8k 岗位职责：安排入住'),{
    form:{address:'古城',headcount:3},gen:{title:'民宿管家',work:'安排入住'}
  })
  assert.deepEqual(parseRecruitmentText('欢迎加入我们'),{form:{},gen:{}})
})

test('保留文案中分句的职责、要求和注意事项', () => {
  const job = parseRecruitmentText('工作职责：接待客人，办理入住，要求耐心，善于沟通')
  assert.deepEqual(job.gen,{work:'接待客人，办理入住',hope:'耐心，善于沟通'})
  const activity = parseActivityText('注意事项：带水，穿运动鞋，每人30元，AA平摊',today)
  assert.deepEqual(activity.values,{safety:'带水，穿运动鞋',aaFee:'30',feeKind:'aa'})
})
