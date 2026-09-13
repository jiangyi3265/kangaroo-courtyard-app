<template>
  <view class="k-page tasks">
    <k-topbar :title="titles[s - 1]" back @back="onBack" />

    <view v-if="s === 1" class="k-body k-pad-tab task-list">
      <view class="week-nav">
        <k-icon name="chevron-left" :size="20" color="ink" />
        <view class="week-box" @click="toast('选择日期范围')"><text>2026年9月1日 - 9月7日</text><k-icon name="chevron-down" :size="13" color="muted" /></view>
        <k-icon name="calendar-days" :size="22" color="ink" />
      </view>
      <view class="status-tabs">
        <view v-for="(item, index) in statusTabs" :key="item.label" class="status-tabs__item" :class="{ active: index === 0 }"><text>{{ item.label }}</text><text>{{ item.count }}</text></view>
      </view>
      <text class="section-title">员工任务</text>
      <view class="task-card">
        <view v-for="item in employeeTasks" :key="item.title" class="task-row" @click="s = 3">
          <image class="task-row__avatar" :src="item.avatar" mode="aspectFill" /><view class="task-row__check" />
          <view class="task-row__main"><text v-if="item.owner" class="task-row__owner">{{ item.owner }}</text><text class="task-row__title" :class="{ 'task-row__title--solo': !item.owner }">{{ item.title }}</text><view class="task-row__meta"><text>{{ item.date }} 截止</text><k-icon name="map-pin" :size="14" color="muted" /><text>{{ item.place }}</text></view></view>
          <view class="priority" :class="'priority--' + item.tone"><text>{{ item.priority }}</text></view>
        </view>
        <view class="task-more" @click.stop="toast('查看全部员工任务')"><text>查看全部员工任务</text><k-icon name="chevron-right" :size="16" color="ink" /></view>
      </view>
      <text class="section-title duty-title">义工任务</text>
      <view class="task-card">
        <view v-for="item in volunteerTasks" :key="item.title" class="task-row task-row--volunteer" @click="s = 3">
          <image class="task-row__avatar" :src="item.avatar" mode="aspectFill" /><view class="task-row__check" />
          <view class="task-row__main"><text class="task-row__title">{{ item.title }}</text><view class="task-row__meta"><text>{{ item.date }} 截止</text><k-icon name="map-pin" :size="14" color="muted" /><text>{{ item.place }}</text></view><text class="claimed"><text class="claimed__num">{{ item.claimed }}</text> 人已认领</text></view>
          <view class="priority" :class="'priority--' + item.tone"><text>{{ item.priority }}</text></view>
        </view>
      </view>
    </view>

    <view v-else-if="s === 2" class="k-body k-pad-tab publish">
      <text class="section-title">任务内容</text>
      <view class="form-card">
        <view class="content-block"><text class="content-block__title">手作课堂协助（陶艺体验课）</text><text class="content-block__desc">协助老师准备材料、引导学员制作、维持课堂秩序、课后清理与整理。</text></view>
        <view class="form-row"><text class="form-row__label">任务日期</text><view class="form-row__field"><text>9月7日（周日）　13:00 - 17:00</text><k-icon name="calendar-days" :size="18" color="ink" /></view></view>
        <view class="form-row"><text class="form-row__label">预估工时</text><view class="form-row__field"><text>4 小时</text><k-icon name="map-pin" :size="15" color="muted" /></view></view>
        <view class="skill-row"><text class="form-row__label">所需技能</text><view class="skill-list"><k-chip v-for="skill in ['沟通协作','手工基础','服务意识']" :key="skill"><text>{{ skill }}</text></k-chip><view class="skill-add"><k-icon name="plus" :size="17" color="ink" /></view></view></view>
      </view>
      <text class="section-title form-section">分配方式</text>
      <view class="assign-card">
        <view class="assign-row"><view class="radio" /><view><text class="assign-row__title">指定员工</text><text class="assign-row__desc">指定小院员工执行</text></view></view>
        <view class="assign-row"><view class="radio radio--on"><k-icon name="check" :size="14" color="white" :stroke="3" /></view><view><text class="assign-row__title">开放给义工</text><text class="assign-row__desc">公开招募义工认领</text></view></view>
      </view>
      <text class="section-title form-section">验收标准</text>
      <view class="accept-card"><text class="k-pre">1. 课堂材料准备齐全、设备正常；\n2. 协助老师完成课程流程，学员满意度不低于90%；\n3. 课后清理干净、物品归位、现场整洁。</text></view>
      <view class="label-row"><text class="section-title form-section">补充说明</text><text class="k-meta">（选填）</text></view>
      <view class="note-field"><text>请输入补充说明</text></view>
      <view class="action-row"><k-button size="md" type="secondary" class="action-row__minor" @click="toast('草稿已保存')">存草稿</k-button><k-button size="md" class="action-row__major" @click="s = 3">发布任务</k-button></view>
    </view>

    <view v-else-if="s === 3" class="k-body k-pad-tab claim-page">
      <view class="success-banner"><view class="success-banner__check"><k-icon name="check" :size="19" color="white" :stroke="3" /></view><view class="k-flex1"><text class="success-banner__title">认领成功！</text><text class="success-banner__desc">你已获得临时角色与工作权限</text></view><image class="success-banner__kangaroo" src="/static/media/tasks-success-kangaroo.jpg" mode="aspectFit" /></view>
      <text class="section-title claim-section">任务信息</text>
      <view class="info-card"><view class="k-between"><text class="info-card__title">手作课堂协助（陶艺体验课）</text><k-chip tone="ochre"><text>开放给义工</text></k-chip></view><text class="info-card__line">9月7日（周日）13:00 - 17:00 · 4小时</text><text class="info-card__line">西湖边 · 温馨一居室</text></view>
      <text class="section-title claim-section">获得角色</text>
      <view class="role-card"><view class="role-shield"><k-icon name="shield-check" :size="25" color="white" /></view><view><text class="role-card__title">课程协助义工</text><text class="role-card__desc">临时角色</text></view></view>
      <text class="section-title claim-section">工作权限范围</text>
      <view class="permission-card"><view v-for="p in permissions" :key="p.text" class="permission-row"><k-icon :name="p.icon" :size="18" color="muted" /><text>{{ p.text }}</text><k-icon name="check" :size="18" color="green" :stroke="2.5" /></view></view>
      <text class="section-title claim-section">有效期</text><text class="valid-time">2026年9月7日 12:30 - 18:00（任务结束自动失效）</text>
      <view class="covenant"><text>请遵守小院公约，用心服务每一位来宾。</text></view>
      <view class="action-row claim-actions"><k-button size="md" type="secondary" class="action-row__minor" @click="s = 1">取消认领</k-button><k-button size="md" class="action-row__major" @click="s = 4">确认并查看任务</k-button></view>
    </view>

    <view v-else class="k-body k-pad-tab done-page">
      <view class="done-banner"><k-icon name="party-popper" :size="34" color="ochre" /><view><text class="done-banner__title">任务已完成！感谢你的付出</text><text class="done-banner__desc">你的经历已自动沉淀到个人档案</text></view></view>
      <text class="section-title done-section">任务回顾</text>
      <view class="info-card"><view class="k-between"><text class="info-card__title">手作课堂协助（陶艺体验课）</text><k-chip tone="green"><text>已完成</text></k-chip></view><text class="info-card__line">9月7日（周日）13:00 - 17:00 · 4小时</text><text class="info-card__line">西湖边 · 温馨一居室</text></view>
      <text class="section-title done-section">验收与评价</text>
      <view class="review-card"><view class="review-person"><image class="review-person__avatar" src="/static/media/tasks-avatar-teacher.jpg" mode="aspectFill" /><view><text class="review-person__name">小晓老师（带教）</text><text class="review-person__time">验收时间：2026-09-07 17:30</text></view></view><view class="stars"><k-icon v-for="n in 6" :key="n" name="star" :size="25" color="ochre" fill="ochre" /><text>5.0</text></view><text class="review-card__text">积极主动、细心负责，学员反馈非常好！</text></view>
      <text class="section-title done-section">工时记录</text>
      <view class="hours"><view class="hours__card"><text>实际工时</text><view><text class="hours__num">4.0</text><text> 小时</text></view></view><view class="hours__card"><text>折算积分</text><view><text class="hours__num">40</text><text> 积分</text></view></view></view>
      <text class="section-title done-section">经历沉淀</text>
      <view class="resume-row"><view class="resume-row__icon"><k-icon name="clipboard-list" :size="18" color="white" /></view><text>已写入你的经验档案</text><view class="k-flex1" /><text>查看我的经历</text><k-icon name="chevron-right" :size="17" color="ink" /></view>
      <view class="action-row done-actions"><k-button size="md" type="secondary" class="k-flex1" @click="toast('正在查看凭证')">查看凭证</k-button><k-button size="md" type="secondary" class="k-flex1" @click="toast('申诉已提交')">申诉</k-button></view>
    </view>

    <k-tabbar mode="staff" active="work" />
  </view>
</template>

<script setup>
import { useScreen, back, toast } from '@/common/screen.js'
const s = useScreen(4)
const titles = ['下周任务', '发布任务', '认领任务', '任务完成']
const onBack = () => { if (s.value > 1) s.value -= 1; else back() }
const statusTabs = [{ label: '待认领', count: 8 }, { label: '进行中', count: 5 }, { label: '已完成', count: 12 }]
const employeeTasks = [
  { owner: '高荣 · 前台接待', title: '周末住宿预订确认', date: '9月6日（周六）', place: '西湖边 · 温馨一居室', priority: '高优先级', tone: 'high', avatar: '/static/media/tasks-avatar-1.jpg' },
  { owner: '小院主人 · 运营', title: '每周经营报表汇总', date: '9月7日（周日）', place: '全门店', priority: '中优先级', tone: 'medium', avatar: '/static/media/tasks-avatar-2.jpg' },
  { owner: '', title: '招聘海报设计', date: '9月5日（周五）', place: '线上', priority: '低优先级', tone: 'low', avatar: '/static/media/tasks-avatar-3.jpg' }
]
const volunteerTasks = [
  { title: '活动场地布置', date: '9月6日（周六）', place: '西湖边 · 温馨一居室', claimed: '2/5', priority: '中优先级', tone: 'medium', avatar: '/static/media/tasks-avatar-4.jpg' },
  { title: '手作课堂协助', date: '9月7日（周日）', place: '西湖边 · 温馨一居室', claimed: '1/4', priority: '低优先级', tone: 'low', avatar: '/static/media/tasks-avatar-5.jpg' }
]
const permissions = [
  { icon: 'camera', text: '查看：课程安排、学员名单、材料清单' },
  { icon: 'mouse-pointer-click', text: '操作：签到登记、课堂协助、上传照片' },
  { icon: 'boxes', text: '使用：教学物料、工具设备、公共区域' },
  { icon: 'messages-square', text: '沟通：课程群聊、向带教老师提问' }
]
</script>

<style scoped lang="scss">
.section-title { display: block; font-family: var(--k-serif); font-size: 17px; font-weight: 700; line-height: 1.25; }
.week-nav { display: flex; align-items: center; justify-content: center; gap: 18px; margin: 0 0 12px; }
.week-box { width: 230px; height: 36px; padding: 0 14px; border: 1px solid var(--k-line2); border-radius: 9px; background: var(--k-paper); display: flex; align-items: center; justify-content: space-between; font-family: var(--k-serif); font-size: 16px; font-weight: 700; }
.status-tabs { display: flex; height: 40px; margin-bottom: 18px; border: 1px solid var(--k-line2); border-radius: 10px; background: var(--k-paper); overflow: hidden; }
.status-tabs__item { flex: 1; display: flex; align-items: center; justify-content: center; gap: 12px; border-left: 1px solid var(--k-line); font-size: 15px; }
.status-tabs__item:first-child { border-left: 0; }
.status-tabs__item.active { color: #fff; background: var(--k-red); font-weight: 600; }
.task-card { margin-top: 8px; border: 1px solid var(--k-line); border-radius: 11px; background: var(--k-paper); overflow: hidden; }
.task-row { position: relative; min-height: 75px; padding: 9px 10px 8px 48px; border-top: 1px solid var(--k-line); display: flex; align-items: flex-start; gap: 10px; }
.task-row:first-child { border-top: 0; }
.task-row__avatar { position: absolute; left: 10px; top: 9px; width: 30px; height: 30px; border-radius: 50%; }
.task-row__check { position: absolute; left: 17px; top: 49px; width: 15px; height: 15px; border: 1.5px solid var(--k-line2); border-radius: 50%; }
.task-row__main { min-width: 0; flex: 1; display: flex; flex-direction: column; }
.task-row__owner { font-size: 12px; color: var(--k-muted); line-height: 1.2; }
.task-row__title { margin-top: 6px; font-family: var(--k-serif); font-weight: 700; font-size: 16px; line-height: 1.25; }
.task-row__title--solo { margin-top: 4px; }
.task-row__meta { display: flex; align-items: center; gap: 7px; margin-top: 6px; color: var(--k-muted); font-size: 12px; white-space: nowrap; }
.priority { position: absolute; right: 10px; top: 9px; height: 24px; padding: 0 8px; border-radius: 6px; display: flex; align-items: center; font-size: 12px; font-weight: 600; }
.priority--high { color: var(--k-red); background: var(--k-red-soft); }
.priority--medium { color: #946620; background: var(--k-ochre-soft); }
.priority--low { color: var(--k-green); background: var(--k-green-soft); }
.task-more { height: 36px; border-top: 1px solid var(--k-line); display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 13px; }
.duty-title { margin-top: 16px; }
.task-row--volunteer { min-height: 82px; }
.task-row--volunteer .task-row__title { margin-top: 0; }
.claimed { margin-top: 5px; color: var(--k-muted); font-size: 12px; }
.claimed__num { color: var(--k-red); font-weight: 700; }

.form-card { margin-top: 8px; border: 1px solid var(--k-line); border-radius: 11px; background: var(--k-paper); overflow: hidden; }
.content-block { padding: 11px 12px 10px; border-bottom: 1px solid var(--k-line); }
.content-block__title { display: block; font-family: var(--k-serif); font-size: 16px; font-weight: 700; }
.content-block__desc { display: block; margin-top: 6px; color: var(--k-muted); font-size: 13px; line-height: 1.55; }
.form-row { min-height: 44px; padding: 0 12px; display: flex; align-items: center; gap: 10px; }
.form-row__label { width: 76px; font-family: var(--k-serif); font-size: 15px; font-weight: 700; flex: 0 0 auto; }
.form-row__field { height: 34px; min-width: 0; flex: 1; padding: 0 10px; border: 1px solid var(--k-line); border-radius: 7px; background: var(--k-bg); display: flex; align-items: center; justify-content: space-between; font-size: 13px; }
.skill-row { padding: 3px 12px 10px; display: flex; align-items: center; gap: 10px; }
.skill-list { display: flex; align-items: center; gap: 6px; }
.skill-add { width: 34px; height: 30px; border: 1px solid var(--k-line); border-radius: 7px; display: flex; align-items: center; justify-content: center; }
.form-section { margin-top: 13px; }
.assign-card { margin-top: 7px; padding: 0 12px; border: 1px solid var(--k-line); border-radius: 11px; background: var(--k-paper); }
.assign-row { height: 48px; display: flex; align-items: center; gap: 13px; border-top: 1px solid var(--k-line); }
.assign-row:first-child { border-top: 0; }
.radio { width: 18px; height: 18px; border: 1.5px solid var(--k-line2); border-radius: 50%; display: flex; align-items: center; justify-content: center; }
.radio--on { border-color: var(--k-green); background: var(--k-green); }
.assign-row__title { display: block; font-family: var(--k-serif); font-size: 15px; font-weight: 700; }
.assign-row__desc { display: block; margin-top: 2px; color: var(--k-muted); font-size: 12px; }
.accept-card { margin-top: 7px; padding: 8px 12px; border: 1px solid var(--k-line); border-radius: 9px; background: var(--k-paper); font-size: 12px; line-height: 1.65; }
.label-row { display: flex; align-items: center; }
.note-field { height: 36px; margin-top: 7px; padding: 0 12px; border: 1px solid var(--k-line); border-radius: 8px; background: var(--k-paper); display: flex; align-items: center; color: var(--k-muted); font-size: 13px; }
.action-row { display: flex; gap: 10px; margin-top: 14px; }
.action-row__minor { flex: .72; }
.action-row__major { flex: 1.28; }

.success-banner { height: 62px; padding: 0 11px; border: 1px solid rgba(79,133,108,.35); border-radius: 10px; background: linear-gradient(90deg, rgba(79,133,108,.08), rgba(249,244,233,.75)); display: flex; align-items: center; gap: 11px; }
.success-banner__check { width: 24px; height: 24px; border-radius: 50%; background: var(--k-green); display: flex; align-items: center; justify-content: center; }
.success-banner__title { display: block; font-family: var(--k-serif); font-size: 17px; font-weight: 700; color: var(--k-green); }
.success-banner__desc { display: block; margin-top: 4px; color: var(--k-muted); font-size: 13px; }
.success-banner__kangaroo { width: 78px; height: 52px; mix-blend-mode: multiply; }
.claim-section { margin-top: 15px; }
.info-card { margin-top: 7px; padding: 11px 12px; border: 1px solid var(--k-line); border-radius: 10px; background: var(--k-paper); }
.info-card__title { font-family: var(--k-serif); font-weight: 700; font-size: 16px; }
.info-card__line { display: block; margin-top: 7px; color: var(--k-muted); font-size: 13px; }
.role-card { height: 58px; margin-top: 7px; padding: 0 12px; border: 1px solid var(--k-line); border-radius: 10px; background: var(--k-paper); display: flex; align-items: center; gap: 13px; }
.role-shield { width: 36px; height: 40px; border-radius: 8px 8px 14px 14px; background: var(--k-green); display: flex; align-items: center; justify-content: center; }
.role-card__title { display: block; font-family: var(--k-serif); font-weight: 700; font-size: 16px; }
.role-card__desc { display: block; margin-top: 3px; color: var(--k-muted); font-size: 12px; }
.permission-card { margin-top: 7px; border: 1px solid var(--k-line); border-radius: 10px; background: var(--k-paper); overflow: hidden; }
.permission-row { height: 35px; padding: 0 11px; border-top: 1px solid var(--k-line); display: flex; align-items: center; gap: 9px; font-size: 12px; }
.permission-row:first-child { border-top: 0; }
.permission-row text { flex: 1; }
.valid-time { display: block; margin-top: 6px; font-size: 13px; }
.covenant { height: 36px; margin-top: 9px; padding: 0 10px; border: 1px solid var(--k-line); border-radius: 8px; background: var(--k-paper2); display: flex; align-items: center; color: var(--k-muted); font-size: 12px; }
.claim-actions { margin-top: 10px; }

.done-banner { height: 62px; padding: 0 12px; border: 1px solid var(--k-line); border-radius: 10px; background: var(--k-paper); display: flex; align-items: center; gap: 11px; }
.done-banner__title { display: block; font-family: var(--k-serif); font-size: 16px; font-weight: 700; color: #8E6123; }
.done-banner__desc { display: block; margin-top: 4px; color: var(--k-muted); font-size: 12px; }
.done-section { margin-top: 15px; }
.review-card { margin-top: 7px; padding: 11px 12px; border: 1px solid var(--k-line); border-radius: 10px; background: var(--k-paper); }
.review-person { display: flex; align-items: center; gap: 10px; }
.review-person__avatar { width: 34px; height: 34px; border-radius: 50%; }
.review-person__name { display: block; font-family: var(--k-serif); font-size: 15px; font-weight: 700; }
.review-person__time { display: block; margin-top: 3px; color: var(--k-muted); font-size: 12px; }
.stars { display: flex; align-items: center; gap: 5px; margin-top: 12px; color: #9A6A22; }
.stars text { margin-left: 8px; font-family: Georgia, serif; font-size: 18px; font-weight: 700; }
.review-card__text { display: block; margin-top: 8px; color: var(--k-muted); font-size: 13px; }
.hours { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 7px; }
.hours__card { height: 66px; padding: 10px 12px; border: 1px solid var(--k-line); border-radius: 10px; background: var(--k-paper); font-size: 13px; }
.hours__num { display: inline-block; margin-top: 5px; font-family: Georgia, serif; font-size: 24px; }
.resume-row { height: 44px; margin-top: 7px; padding: 0 12px; border: 1px solid var(--k-line); border-radius: 9px; background: var(--k-paper); display: flex; align-items: center; gap: 8px; font-size: 13px; }
.resume-row__icon { width: 22px; height: 26px; border-radius: 5px; background: #8C8FA6; display: flex; align-items: center; justify-content: center; }
.done-actions { margin-top: 14px; }
</style>
