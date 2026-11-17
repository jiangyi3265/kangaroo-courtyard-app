<template>
  <!-- #ifdef MP-WEIXIN -->
  <page-meta :page-style="calendar || staffPop || checkPop ? 'overflow: hidden' : ''" />
  <!-- page-meta 必须是页面第一个节点。日历、指定员工弹框开着时锁住页面滚动：弹框里的 scroll-view 不能用 catchtouchmove 拦（拦了它自己也滑不动）；只在小程序里加：H5 的 page-meta 关弹窗时清不掉这条样式，顶栏会从此不吸顶 -->
  <!-- #endif -->
  <view class="k-page tasks">
    <k-topbar :title="s === 1 ? listTitle : titles[s - 1]" back custom-back @back="onBack" />
    <k-subscribe scenes="work_task" label="订阅工作任务提醒" />

    <view v-if="s === 1" class="k-body k-pad-tab task-list">
      <view class="week-nav">
        <view class="week-arrow" @click="shiftWeek(-1)"><k-icon name="chevron-left" :size="20" color="ink" /></view>
        <view class="week-box" @click="pickWeek"><text>{{ list.weekText || '加载中…' }}</text><k-icon name="chevron-down" :size="13" color="muted" /></view>
        <view class="week-arrow" @click="pickWeek"><k-icon name="calendar-days" :size="22" color="ink" /></view>
      </view>
      <view class="status-tabs">
        <view v-for="(item, index) in statusTabs" :key="item.label" class="status-tabs__item" :class="{ active: index === tabIndex }" @click="setTab(index)"><text>{{ item.label }}</text><text>{{ item.count }}</text></view>
      </view>
      <!-- 之前列表里没有发布入口：从业务中心「查看任务」进来、或发布完一条回到列表后，想再发一条只能退出去重进 -->
      <view v-if="!volunteerView" class="k-between"><text class="section-title">员工任务</text><view v-if="list.canPublish" class="publish-link" @click="openPublish"><k-icon name="plus" :size="14" color="red" /><text>发布任务</text></view></view>
      <view v-if="!volunteerView" class="task-card">
        <view v-for="item in employeeTasks" :key="item.taskId + item.title" class="task-row" @click="openTask(item)">
          <image class="task-row__avatar" :src="item.avatar" mode="aspectFill" /><view class="task-row__check" />
          <view class="task-row__main"><text v-if="item.owner" class="task-row__owner">{{ item.owner }}</text><text class="task-row__title" :class="{ 'task-row__title--solo': !item.owner }">{{ item.title }}</text><view class="task-row__meta"><text>{{ item.date }} 截止</text><k-icon name="map-pin" :size="14" color="muted" /><text class="task-row__place">{{ item.place }}</text></view><text v-if="item.mine" class="mine-line">{{ item.mine }}</text></view>
          <view class="priority" :class="'priority--' + item.tone"><text>{{ item.priority }}</text></view>
        </view>
        <view class="task-more" @click.stop="openAllStaffTasks"><text>{{ moreText }}</text><k-icon name="chevron-right" :size="16" color="ink" /></view>
      </view>
      <text class="section-title" :class="{ 'duty-title': !volunteerView }">换工任务</text>
      <!-- 没有员工授权的在店换工从「我的 → 门店任务」或任务消息进来：只看换工任务，并说明谁能认领、怎么得积分 -->
      <text v-if="volunteerView" class="vol-tip">近 90 天在门店入职的换工可以认领这里的换工任务，验收后按实际工时得积分（1 小时 10 积分）。</text>
      <view class="task-card">
        <view v-for="item in volunteerTasks" :key="item.taskId + item.title" class="task-row task-row--volunteer" @click="openTask(item)">
          <image class="task-row__avatar" :src="item.avatar" mode="aspectFill" /><view class="task-row__check" />
          <view class="task-row__main"><text class="task-row__title">{{ item.title }}</text><view class="task-row__meta"><text>{{ item.date }} 截止</text><k-icon name="map-pin" :size="14" color="muted" /><text class="task-row__place">{{ item.place }}</text></view><text class="claimed"><text class="claimed__num">{{ item.claimed }}</text> 人已认领<text v-if="item.mine" class="mine-tag">{{ item.mine }}</text></text></view>
          <view class="priority" :class="'priority--' + item.tone"><text>{{ item.priority }}</text></view>
        </view>
      </view>
    </view>

    <!-- 2026-11-03 主人：简化发布。原来标题、说明、身份、职责、地点、优先级都藏在「任务内容」一个菜单后面，每项「菜单 → 系统弹窗」两步，
         工时、技能、名额、验收标准、补充说明又各一个弹窗，发一条约 15 个弹窗；现在是一张表直接填（版式同 pages/staff/form-clean.scss：
         输入框、平排方块、加减号），底栏一直写着还差什么，提交不弹确认。逻辑在 tasks-form.js，提交给服务端的字段一项没变 -->
    <view v-else-if="s === 2" class="fc-form publish">
      <view class="fc-block">
        <text class="fc-group__title">任务内容</text>
        <view class="fc-field">
          <view class="fc-label"><text class="fc-label__t">任务标题</text><text class="fc-req">必填</text><text class="fc-count">{{ cnt(f.title) }}/{{ TITLE_MAX }}</text></view>
          <input class="fc-input" :class="{ 'fc-input--err': errs.title }" :value="f.title" :maxlength="TITLE_MAX" placeholder="例如：周六手工课协助" placeholder-class="fc-ph" @input="f.title = $event.detail.value" />
          <text v-if="errs.title" class="fc-err">{{ errs.title }}</text>
        </view>
        <view class="fc-field">
          <view class="fc-label"><text class="fc-label__t">任务说明</text><text class="fc-count">{{ cnt(f.description) }}/{{ DESC_MAX }}</text></view>
          <!-- 小程序 textarea 是原生层，会盖住日历：不在输入时换成同样外观的 view，点了才换回来（同 reimburse.vue） -->
          <textarea v-if="editing === 'description'" class="fc-area fc-area--short" :value="f.description" :maxlength="DESC_MAX" placeholder="要做什么、注意什么" placeholder-class="fc-ph" :focus="true" auto-focus :show-confirm-bar="false" @input="f.description = $event.detail.value" @blur="editing = ''" />
          <view v-else class="fc-area fc-area--short fc-area--idle" hover-class="k-press" @click="editing = 'description'"><text :class="{ 'fc-ph': !f.description }">{{ f.description || '要做什么、注意什么' }}</text></view>
        </view>
        <view class="fc-field">
          <view class="fc-label"><text class="fc-label__t">任务身份</text><text class="fc-count">{{ cnt(f.roleName) }}/{{ ROLE_MAX }}</text></view>
          <input class="fc-input" :value="f.roleName" :maxlength="ROLE_MAX" placeholder="例如：课程协助换工" placeholder-class="fc-ph" @input="f.roleName = $event.detail.value" />
          <text class="fc-note">只是称呼，不含系统权限</text>
        </view>
        <view class="fc-field">
          <view class="fc-label"><text class="fc-label__t">职责范围</text><text class="fc-count">{{ scopeCount }}/{{ SCOPE_MAX }} 条</text></view>
          <textarea v-if="editing === 'scope'" class="fc-area fc-area--short" :value="f.scopeText" :maxlength="300" placeholder="一行一条，例如：签到登记" placeholder-class="fc-ph" :focus="true" auto-focus :show-confirm-bar="false" @input="f.scopeText = $event.detail.value" @blur="editing = ''" />
          <view v-else class="fc-area fc-area--short fc-area--idle" hover-class="k-press" @click="editing = 'scope'"><text :class="{ 'fc-ph': !f.scopeText }">{{ f.scopeText || '一行一条，例如：签到登记' }}</text></view>
          <text class="fc-note">一行写一条（用「；」隔开也行），最多 6 条，认领的人会看到</text>
        </view>
        <view class="fc-field">
          <view class="fc-label"><text class="fc-label__t">地点</text><text class="fc-count">{{ cnt(f.place) }}/{{ PLACE_MAX }}</text></view>
          <input class="fc-input" :value="f.place" :maxlength="PLACE_MAX" placeholder="不填就是门店" placeholder-class="fc-ph" @input="f.place = $event.detail.value" />
        </view>
        <view class="fc-field">
          <view class="fc-label"><text class="fc-label__t">优先级</text></view>
          <view class="fc-seg fc-seg--3"><view v-for="pr in PRIORITIES" :key="pr[1]" class="fc-seg__item" :class="{ on: f.priority === pr[1] }" hover-class="k-press" @click="f.priority = pr[1]"><text>{{ pr[0] }}优先级</text></view></view>
        </view>
      </view>
      <view class="fc-block">
        <text class="fc-group__title">时间与工时</text>
        <view class="fc-row" :class="{ 'fc-row--err': errs.taskDate }" hover-class="k-press" @click="calendar = 'task'"><text class="fc-row__k">任务日期</text><text class="fc-req">必填</text><text class="fc-row__v">{{ dateText }}</text><k-icon name="chevron-right" :size="18" color="muted" /></view>
        <!-- 开始、结束各自一个按钮，点哪个改哪个；之前选完日期被强制接着弹两个时刻选择 -->
        <view class="fc-row" :class="{ 'fc-row--err': errs.endTime, 'fc-row--open': errs.endTime }"><text class="fc-row__k">时间段</text><view class="fc-when"><picker mode="time" :value="f.startTime" @change="f.startTime = $event.detail.value"><view class="fc-pick" hover-class="k-press-s"><text class="fc-pick__t">{{ f.startTime }} 开始</text></view></picker><picker mode="time" :value="f.endTime" @change="f.endTime = $event.detail.value"><view class="fc-pick" hover-class="k-press-s"><text class="fc-pick__t">{{ f.endTime }} 结束</text></view></picker></view></view>
        <view v-if="errs.endTime" class="fc-sub"><text class="fc-err">{{ errs.endTime }}</text></view>
        <view class="fc-row"><text class="fc-row__k">预估工时</text><view class="fc-stepper"><view class="fc-stepper__btn" hover-class="k-press" @click="f.estHours = stepHours(f.estHours, -1)"><k-icon name="minus" :size="20" :color="f.estHours <= HOURS_MIN ? 'light' : 'ink'" /></view><text class="fc-stepper__num">{{ f.estHours }} 小时</text><view class="fc-stepper__btn" hover-class="k-press" @click="f.estHours = stepHours(f.estHours, 1)"><k-icon name="plus" :size="20" :color="f.estHours >= HOURS_MAX ? 'light' : 'ink'" /></view></view></view>
        <view class="fc-field">
          <view class="fc-label"><text class="fc-label__t">所需技能</text><text class="fc-count">{{ f.skills.length }}/{{ SKILL_MAX }}</text></view>
          <view v-if="f.skills.length" class="fc-tags"><view v-for="(sk, k) in f.skills" :key="sk" class="fc-tag" hover-class="k-press" @click="f.skills = removeSkill(f.skills, k)"><text>{{ sk }}</text><view class="fc-tag__x"><k-icon name="x" :size="16" color="muted" /></view></view></view>
          <view v-if="f.skills.length < SKILL_MAX" class="skill-add" :class="{ 'fc-gap': f.skills.length }"><input class="fc-input skill-add__input" :value="skillDraft" :maxlength="SKILL_LEN" placeholder="例如：手工基础" placeholder-class="fc-ph" confirm-type="done" @input="skillDraft = $event.detail.value" @confirm="pushSkill" /><view class="skill-add__btn" hover-class="k-press-s" @click="pushSkill"><text>添加</text></view></view>
          <text class="fc-note">选填；点已加的技能可以删掉</text>
        </view>
      </view>
      <view class="fc-block">
        <text class="fc-group__title">分配方式</text>
        <view class="fc-field">
          <view class="fc-seg fc-seg--2"><view v-for="md in MODES" :key="md[1]" class="fc-seg__item" :class="{ on: f.mode === md[1] }" hover-class="k-press" @click="f.mode = md[1]"><text>{{ md[0] }}</text></view></view>
          <text class="fc-note">{{ f.mode === 'staff' ? '指定本店员工执行，对方要点「接受」' : '近 90 天在本店入职的换工都能认领，验收后按工时得积分' }}</text>
        </view>
        <view v-if="f.mode === 'staff'" class="fc-row" :class="{ 'fc-row--err': errs.assignees }" hover-class="k-press" @click="pickStaff"><text class="fc-row__k">指定员工</text><text class="fc-req">必填</text><text class="fc-row__v" :class="{ 'fc-row__v--empty': !f.assigneeNames.length }">{{ f.assigneeNames.length ? f.assigneeNames.join('、') : '请选择，最多 5 人' }}</text><k-icon name="chevron-right" :size="18" color="muted" /></view>
        <view v-else class="fc-row"><text class="fc-row__k">换工名额</text><view class="fc-stepper"><view class="fc-stepper__btn" hover-class="k-press" @click="f.quota = stepQuota(f.quota, -1)"><k-icon name="minus" :size="20" :color="f.quota <= QUOTA_MIN ? 'light' : 'ink'" /></view><text class="fc-stepper__num">{{ f.quota }} 人</text><view class="fc-stepper__btn" hover-class="k-press" @click="f.quota = stepQuota(f.quota, 1)"><k-icon name="plus" :size="20" :color="f.quota >= QUOTA_MAX ? 'light' : 'ink'" /></view></view></view>
      </view>
      <view class="fc-block">
        <text class="fc-group__title">验收与说明</text>
        <view class="fc-field">
          <view class="fc-label"><text class="fc-label__t">验收标准</text><text class="fc-count">{{ cnt(f.acceptRule) }}/{{ ACCEPT_MAX }}</text></view>
          <textarea v-if="editing === 'accept'" class="fc-area fc-area--short" :value="f.acceptRule" :maxlength="ACCEPT_MAX" placeholder="例如：材料齐全；课堂有序；现场整洁" placeholder-class="fc-ph" :focus="true" auto-focus :show-confirm-bar="false" @input="f.acceptRule = $event.detail.value" @blur="editing = ''" />
          <view v-else class="fc-area fc-area--short fc-area--idle" hover-class="k-press" @click="editing = 'accept'"><text :class="{ 'fc-ph': !f.acceptRule }">{{ f.acceptRule || '例如：材料齐全；课堂有序；现场整洁' }}</text></view>
          <text class="fc-note">接单人认领前就能看到</text>
        </view>
        <view class="fc-field">
          <view class="fc-label"><text class="fc-label__t">补充说明</text><text class="fc-count">{{ cnt(f.note) }}/{{ NOTE_MAX }}</text></view>
          <textarea v-if="editing === 'note'" class="fc-area fc-area--short" :value="f.note" :maxlength="NOTE_MAX" placeholder="选填" placeholder-class="fc-ph" :focus="true" auto-focus :show-confirm-bar="false" @input="f.note = $event.detail.value" @blur="editing = ''" />
          <view v-else class="fc-area fc-area--short fc-area--idle" hover-class="k-press" @click="editing = 'note'"><text :class="{ 'fc-ph': !f.note }">{{ f.note || '选填' }}</text></view>
        </view>
      </view>
      <!-- 底栏：上面一行一直写着还差什么（点了发布才把漏填的标红），下面存草稿 / 发布任务，不再弹确认 -->
      <view class="fc-bar">
        <view class="fc-bar__todo" :class="{ 'fc-bar__todo--err': tried && errKeys.length, 'fc-bar__todo--ok': !errKeys.length }"><text>{{ todoText }}</text></view>
        <view class="fc-bar__btns"><view class="fc-btn fc-btn--ghost" hover-class="k-press-s" @click="save(false)"><text>存草稿</text></view><view class="fc-btn" hover-class="k-press-s" @click="save(true)"><text>发布任务</text></view></view>
      </view>
    </view>

    <view v-else-if="s === 3" class="k-body k-pad-tab claim-page">
      <view v-if="claimed" class="success-banner"><view class="success-banner__check"><k-icon name="check" :size="19" color="white" :stroke="3" /></view><view class="k-flex1"><text class="success-banner__title">{{ bannerTitle }}</text><text class="success-banner__desc">请按下方职责范围参与本次任务</text></view><image class="success-banner__kangaroo" src="/static/media/tasks-success-kangaroo.jpg" mode="aspectFit" /></view>
      <text class="section-title claim-section">任务信息</text>
      <view class="info-card"><view class="k-between"><text class="info-card__title">{{ t ? t.title : '' }}</text><view v-if="t && t.modeLabel" class="info-card__chip"><k-chip tone="ochre"><text>{{ t.modeLabel }}</text></k-chip></view></view><text class="info-card__line">{{ t ? t.timeText : '' }}</text><text class="info-card__line">{{ t ? t.place : '' }}</text></view>
      <text class="section-title claim-section">任务身份</text>
      <view class="role-card"><view class="role-shield"><k-icon name="shield-check" :size="25" color="white" /></view><view><text class="role-card__title">{{ t ? t.roleName : '' }}</text><text class="role-card__desc">仅限本次任务，不含系统权限</text></view></view>
      <text class="section-title claim-section">任务职责范围</text>
      <view class="permission-card"><view v-for="p in permissions" :key="p.text" class="permission-row"><k-icon :name="p.icon" :size="18" color="muted" /><text>{{ p.text }}</text><k-icon name="check" :size="18" color="green" :stroke="2.5" /></view></view>
      <text class="section-title claim-section">有效期</text><text class="valid-time">{{ t ? t.validText : '' }}</text>
      <view class="covenant"><text>{{ t ? t.note : '' }}</text></view>
      <view class="action-row claim-actions"><k-button size="md" type="secondary" class="action-row__minor" @click="unclaim" :label="claimed ? '取消认领' : (t && t.canDecline ? '无法参加' : '返回列表')" /><k-button size="md" class="action-row__major" @click="claim" :label="claimed ? '查看我的任务' : '确认并认领'" /></view>
    </view>

    <view v-else class="k-body k-pad-tab done-page">
      <view class="done-banner"><k-icon name="party-popper" :size="34" color="ochre" /><view><text class="done-banner__title">任务已完成！感谢你的付出</text><text class="done-banner__desc">{{ mine && mine.expWritten ? '你的经历已沉淀到个人档案' : '工时与评价已记录' }}</text></view></view>
      <text class="section-title done-section">任务回顾</text>
      <view class="info-card"><view class="k-between"><text class="info-card__title">{{ t ? t.title : '' }}</text><view class="info-card__chip"><k-chip tone="green"><text>已完成</text></k-chip></view></view><text class="info-card__line">{{ t ? t.timeText : '' }}</text><text class="info-card__line">{{ t ? t.place : '' }}</text></view>
      <text class="section-title done-section">验收与评价</text>
      <view class="review-card"><view class="review-person"><image class="review-person__avatar" :src="checkerAvatar" mode="aspectFill" /><view><text class="review-person__name">{{ mine ? (mine.checkedName || '主理人') + '（验收人）' : '' }}</text><text class="review-person__time">验收时间：{{ mine ? mine.checkedTime : '' }}</text></view></view><view class="stars"><k-icon v-for="n in ratingNum" :key="n" name="star" :size="25" color="ochre" fill="ochre" /><text>{{ ratingNum.toFixed(1) }}</text></view><text class="review-card__text">{{ mine && mine.comment ? mine.comment : '（验收人没有写评语）' }}</text></view>
      <text class="section-title done-section">工时记录</text>
      <view class="hours"><view class="hours__card"><text>实际工时</text><view><text class="hours__num">{{ mine ? mine.actualHours : '—' }}</text><text> 小时</text></view></view><view class="hours__card"><text>折算积分</text><view><text class="hours__num">{{ mine ? mine.points : 0 }}</text><text> 积分</text></view></view></view>
      <text v-if="mine && mine.expWritten" class="section-title done-section">经历沉淀</text>
      <view v-if="mine && mine.expWritten" class="resume-row" @click="openResume"><view class="resume-row__icon"><k-icon name="clipboard-list" :size="18" color="white" /></view><text>已写入你的经验档案</text><view class="k-flex1" /><text>查看我的经历</text><k-icon name="chevron-right" :size="17" color="ink" /></view>
      <view class="action-row done-actions"><k-button size="md" type="secondary" class="k-flex1" @click="viewProofs" label="查看凭证" /><k-button size="md" type="secondary" class="k-flex1" @click="appeal" label="申诉" /></view>
    </view>

    <!-- 发布表单有自己的底栏（fc-bar），这时不叠底部导航 -->
    <k-tabbar v-if="s !== 2" :mode="tabMode" :active="tabMode === 'staff' ? 'work' : 'profile'" />
    <!-- 选周 / 任务日期：之前是手敲 yyyy-MM-dd、30 天的分页菜单，改成日历 -->
    <k-date-picker v-if="calendar" :title="calendar === 'week' ? '查看哪一天所在的周' : '任务日期'" :value="calendar === 'week' ? (weekStart || todayCn()) : f.taskDate" :min-date="calendar === 'task' ? todayCn() : ''" @cancel="calendar = ''" @confirm="confirmCalendar" />
    <!-- 指定员工：之前要在分页菜单里一个个点、每点一次菜单重开一次；改成一屏勾选。标题和按钮区不会滚，拖动时拦住，之前在上面拖背后的页面会跟着滚 -->
    <view v-if="staffPop" class="chip-pop">
      <view class="chip-pop__mask" @click="staffPop = null" @touchmove.stop.prevent />
      <view class="chip-pop__panel">
        <view class="chip-pop__head" @touchmove.stop.prevent><text class="chip-pop__title">指定员工</text><text class="chip-pop__hint">最多 5 人，已选 {{ staffPop.draft.length }}</text></view>
        <scroll-view scroll-y class="chip-pop__scroll"><view class="chip-pop__chips"><text v-for="u in staffPop.list" :key="u.userId" class="chip-pop__chip" :class="{ on: staffPicked(u) }" @click="toggleStaff(u)">{{ u.nickname || '用户' + u.userId }}</text></view></scroll-view>
        <view class="chip-pop__foot" @touchmove.stop.prevent><view class="chip-pop__btn"><k-button block type="secondary" label="清空" @click="staffPop.draft = []" /></view><view class="chip-pop__btn chip-pop__btn--main"><k-button block label="确定" @click="confirmStaff" /></view></view>
      </view>
    </view>
    <!-- 2026-11-03 主人：简化验收。原来「选人 → 填工时 → 选星 → 写评语 → 问传不传凭证」5–6 个系统弹窗，一步错了从头来；
         改成一个底部面板：人、工时、星、评语、凭证一次填完 → 「验收通过」；积分一发就收不回，结算前那一次确认框保留 -->
    <view v-if="checkPop" class="chip-pop check-pop">
      <view class="chip-pop__mask" @click="closeCheck" @touchmove.stop.prevent />
      <view class="chip-pop__panel">
        <view class="chip-pop__head" @touchmove.stop.prevent><text class="chip-pop__title">验收接单人</text><text class="chip-pop__hint">{{ checkPop.title }}</text></view>
        <scroll-view scroll-y class="chip-pop__scroll check-pop__scroll">
          <view class="check-pop__sec"><text class="check-pop__k">验收谁</text><view class="chip-pop__chips"><text v-for="p in checkPop.people" :key="p.userId" class="chip-pop__chip" :class="{ on: String(checkPop.userId) === String(p.userId) }" @click="checkPop.userId = p.userId">{{ p.name }}</text></view></view>
          <view class="check-pop__sec check-pop__row"><text class="check-pop__k">实际工时</text><view class="fc-stepper"><view class="fc-stepper__btn" hover-class="k-press" @click="checkPop.hours = stepCheckHours(checkPop.hours, -1)"><k-icon name="minus" :size="20" color="ink" /></view><input class="check-pop__hours" type="digit" :value="String(checkPop.hours)" maxlength="4" placeholder="0.5–24" placeholder-class="fc-ph" @input="checkPop.hours = $event.detail.value" /><view class="fc-stepper__btn" hover-class="k-press" @click="checkPop.hours = stepCheckHours(checkPop.hours, 1)"><k-icon name="plus" :size="20" color="ink" /></view></view><text class="check-pop__unit">小时</text></view>
          <view class="check-pop__sec"><text class="check-pop__k">评分</text><view class="check-pop__stars"><view v-for="n in 5" :key="n" class="check-pop__star" hover-class="k-press" @click="checkPop.rating = n"><k-icon name="star" :size="30" color="ochre" :fill="n <= checkPop.rating" :stroke="1.6" /></view><text class="check-pop__star-label">{{ checkPop.rating }} 星 · {{ RATING_LABELS[checkPop.rating] }}</text></view></view>
          <view class="check-pop__sec"><view class="fc-label"><text class="fc-label__t">评语</text><text class="fc-count">{{ cnt(checkPop.comment) }}/{{ CHECK_COMMENT_MAX }}</text></view>
            <textarea v-if="editing === 'comment'" class="fc-area fc-area--short" :value="checkPop.comment" :maxlength="CHECK_COMMENT_MAX" placeholder="选填，例如：细心负责，现场整洁" placeholder-class="fc-ph" :focus="true" auto-focus :show-confirm-bar="false" @input="checkPop.comment = $event.detail.value" @blur="editing = ''" />
            <view v-else class="fc-area fc-area--short fc-area--idle" hover-class="k-press" @click="editing = 'comment'"><text :class="{ 'fc-ph': !checkPop.comment }">{{ checkPop.comment || '选填，例如：细心负责，现场整洁' }}</text></view>
          </view>
          <view class="check-pop__sec"><view class="fc-label"><text class="fc-label__t">凭证照片</text><text class="fc-count">{{ checkPop.proofs.length }}/{{ CHECK_PROOF_MAX }}</text></view>
            <view class="fc-photos">
              <view v-for="(url, pi) in checkPop.proofs" :key="url" class="fc-photo" hover-class="k-press-s" @click="removeProof(pi)"><image class="fc-photo__img" :src="absUrl(url)" mode="aspectFill" /><view class="fc-photo__del"><view class="fc-photo__x"><k-icon name="x" :size="14" color="white" :stroke="2.2" /></view></view></view>
              <view v-if="checkPop.proofs.length < CHECK_PROOF_MAX" class="fc-photo" hover-class="k-press-s" @click="addProofs"><view class="fc-photo__add"><k-icon name="plus" :size="22" color="ink2" /><text>{{ checkUploading ? '上传中' : '添加' }}</text></view></view>
            </view>
            <text class="fc-note">选填，现场照片等；接单人在「任务完成」页能看到，点照片可以删掉</text>
          </view>
        </scroll-view>
        <view class="chip-pop__foot check-pop__foot" @touchmove.stop.prevent>
          <text class="check-pop__todo" :class="{ 'check-pop__todo--err': checkErrKeys.length }">{{ checkTodo }}</text>
          <view class="fc-bar__btns"><view class="fc-btn fc-btn--ghost" hover-class="k-press-s" @click="closeCheck"><text>先不验收</text></view><view class="fc-btn" :class="{ 'fc-btn--off': checkUploading }" hover-class="k-press-s" @click="submitCheck"><text>验收通过</text></view></view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
// ---------------------------------------------------------------------------
// 门店任务接入情况：
//   s=1 任务列表：按周（员工默认下周，在店换工默认本周）、待认领 / 进行中 / 已完成；主理人 / 管家点任务可验收、取消、编辑 / 删除草稿；
//       没有员工授权的在店换工只看换工任务（从「我的 → 门店任务」或任务消息进来）
//   s=2 发布任务（主理人 / 管家）：指定本店员工，或开放给近 90 天在本店入职的换工认领。2026-11-03 主人：简化成一张表直接填（规则在 tasks-form.js）；
//       验收也从一串系统弹窗改成一个底部面板（checkPop），只在结算前确认一次
//   s=3 认领 / 接受：「任务身份」只是称呼，不授予任何系统权限
//   s=4 任务完成：验收人、评分、实际工时、折算积分（1 小时 = 10 积分，生日当天双倍）、换工的经历写入档案
// ---------------------------------------------------------------------------
import { ref, computed, watch } from 'vue'
import { useScreen, go, back, toast } from '@/common/screen.js'
import { apiTasks, apiTask, apiTaskStaff, apiTaskSave, apiTaskClaim, apiTaskUnclaim, apiTaskCheck, apiTaskCancel } from '@/common/api.js'
import { ensureSession, hasStaffAccess, currentStaffStoreId } from '@/common/experience.js'
import { sheet, prompt, alert, confirm, pickPaged, shiftDate, todayCn, isYmd, errText } from '@/common/ui.js'
import { absUrl, uploadTo, chooseImages } from '@/common/upload.js'
import { post } from '@/common/request.js'
import R from '@/common/routes.js'
// 2026-11-03 主人：简化发布与验收。表单 / 验收面板的规则、提交内容都在分包里的 tasks-form.js（纯函数，node --test 直接跑）
import { TITLE_MAX, DESC_MAX, ROLE_MAX, SCOPE_MAX, PLACE_MAX, SKILL_MAX, SKILL_LEN, ACCEPT_MAX, NOTE_MAX, HOURS_MIN, HOURS_MAX, QUOTA_MIN, QUOTA_MAX,
  CHECK_COMMENT_MAX, CHECK_PROOF_MAX, PRIORITIES, MODES, RATING_LABELS, blankTask, formFromTask, taskPayload, taskErrors, taskErrKeys, taskTodoText,
  splitScope, stepHours, stepQuota, addSkill, removeSkill, taskDateText, blankCheck, stepCheckHours, checkErrors, checkTodoText, checkPayload, checkConfirmText } from './tasks-form.js'

// 被指定的员工「无法参加」（只在这一页用，不往主包的 api.js 里加）
const apiTaskDecline = (id, reason) => post('/app/manage/tasks/' + id + '/decline', { reason })

let booting = true
// 任务所属门店：链接指定的优先（业务中心、看板「生成改进计划」会带上），否则用员工端当前门店；
// 换工没有员工授权时为空，由服务端按其入职过的门店取任务。
const storeId = ref(null)
const s = useScreen(4, {
  onLoad: async (q) => {
    if (q?.weekStart) weekStart.value = q.weekStart
    await ensureSession()
    storeId.value = q?.storeId || currentStaffStoreId()
    if (Number(q?.taskId)) {
      await openById(Number(q.taskId), true)
    } else if (s.value === 2) {
      await loadList()
      if (!list.value.canPublish) { toast('仅换工主理人或小院主理人可以发布任务'); s.value = 1 }
    } else {
      await loadList()
    }
    booting = false
  }
})
const titles = ['门店任务', '发布任务', '认领任务', '任务完成']
const onBack = () => { if (s.value > 1) s.value = 1; else back() }
// 换屏时收起正在输入的大段文字框：textarea 随页面一起卸掉时不一定触发 blur，不收起的话下次打开发布页会直接弹键盘
watch(s, (v) => { editing.value = ''; if (!booting && v === 1) loadList() })
const tabMode = computed(() => (hasStaffAccess.value ? 'staff' : 'user'))

// ---------------- s=1 列表 ----------------
const list = ref({ tabs: [], staffTasks: [], volunteerTasks: [], canPublish: false })
// 换工视图：不是本店员工（在店换工、没有员工授权）时只显示换工任务。以服务端 list 返回的 isStaff 为准，还没加载时按本机授权先猜
const volunteerView = computed(() => !(list.value.isStaff === undefined ? hasStaffAccess.value : list.value.isStaff) && !list.value.canPublish)
const weekStart = ref('')
// 列表标题按正在看的那一周写：之前员工这边固定「下周任务」，从任务消息进来（或点「无法参加」回到列表）看的是本周也写下周
const mondayOf = (ymd) => shiftDate(ymd, -((new Date(ymd + 'T00:00:00Z').getUTCDay() + 6) % 7))
const listTitle = computed(() => {
  const w = list.value.weekStart || weekStart.value
  if (volunteerView.value || !isYmd(w)) return '门店任务'
  const k = Math.round((Date.parse(mondayOf(w) + 'T00:00:00Z') - Date.parse(mondayOf(todayCn()) + 'T00:00:00Z')) / 604800000)
  return ['上周任务', '本周任务', '下周任务'][k + 1] || '门店任务'
})
const tabIndex = ref(0)
const KEYS = ['open', 'doing', 'done']
const showAll = ref(false)
async function loadList() {
  try {
    list.value = (await apiTasks({ storeId: storeId.value || undefined, weekStart: weekStart.value || undefined, tab: KEYS[tabIndex.value] })).data || list.value
    weekStart.value = list.value.weekStart
  } catch (e) {
    toast(errText(e, '任务加载失败'))
  }
}
const statusTabs = computed(() => ((list.value.tabs || []).length ? list.value.tabs : [{ label: '待认领', count: 0 }, { label: '进行中', count: 0 }, { label: '已完成', count: 0 }]))
// 没有头像时用全站默认头像（袋鼠）。之前轮流用设计稿里 5 位员工的照片，没人认领的任务、空列表也像有人接了
const DEFAULT_AVATAR = '/static/media/profile-avatar.jpg'
const withAvatar = (arr) => arr.map(t => ({ ...t, avatar: t.avatar ? absUrl(t.avatar) : DEFAULT_AVATAR }))
const employeeTasks = computed(() => {
  const all = withAvatar(list.value.staffTasks || [])
  if (!all.length) return [{ taskId: 0, owner: '', title: '这一周还没有员工任务', date: '—', place: '—', priority: '—', tone: 'low', avatar: DEFAULT_AVATAR }]
  return showAll.value ? all : all.slice(0, 3)
})
const volunteerTasks = computed(() => {
  const all = withAvatar(list.value.volunteerTasks || [])
  return all.length ? all : [{ taskId: 0, title: '这一周还没有换工任务', date: '—', place: '—', claimed: '0/0', priority: '—', tone: 'low', avatar: DEFAULT_AVATAR }]
})
const openPublish = () => { if (f.value.taskId) f.value = blank(); tried.value = false; s.value = 2 }
const moreText = computed(() => ((list.value.staffTasks || []).length > 3 ? (showAll.value ? '收起' : `查看全部员工任务（${list.value.staffTasks.length}）`) : '查看本周全部员工任务'))
// 「查看全部员工任务」：本页签超过 3 条时就地展开 / 收起；不足 3 条时本页签已经全部列出，
// 这时列出本周三种状态（待认领 / 进行中 / 已完成）的全部员工任务，点一条直接打开，不再点了没反应
async function openAllStaffTasks() {
  if ((list.value.staffTasks || []).length > 3) { showAll.value = !showAll.value; return }
  try {
    const params = { storeId: storeId.value || undefined, weekStart: weekStart.value || undefined }
    const pages = await Promise.all(KEYS.map((tab, k) => (k === tabIndex.value ? { data: list.value } : apiTasks({ ...params, tab }))))
    const all = []
    pages.forEach((r, k) => ((r && r.data && r.data.staffTasks) || []).forEach(x => all.push({ ...x, state: (statusTabs.value[k] || {}).label || '' })))
    if (!all.length) return toast('这一周还没有员工任务')
    const i = await pickPaged(all.map(x => `【${x.state}】${x.date} ${x.title}${x.owner ? ' · ' + x.owner : ''}`), '选择任务')
    if (i >= 0) openTask(all[i])
  } catch (e) {
    toast(errText(e, '任务加载失败'))
  }
}
const setTab = (i) => { tabIndex.value = i; loadList() }
const shiftWeek = (n) => { weekStart.value = shiftDate(weekStart.value || todayCn(), n * 7); loadList() }
async function pickWeek() {
  const base = todayCn()
  const opts = ['本周', '下周', '下下周', '选择日期…']
  const i = await sheet(opts)
  if (i < 0) return
  if (i === 3) { calendar.value = 'week'; return }
  const d = new Date(base + 'T00:00:00')
  const mon = shiftDate(base, -((d.getDay() + 6) % 7))
  weekStart.value = shiftDate(mon, i * 7)
  loadList()
}
// 日历：'week' = 选周，'task' = 发布页的任务日期
const calendar = ref('')
async function confirmCalendar(v) {
  const which = calendar.value
  calendar.value = ''
  if (!v) return
  if (which === 'week') { weekStart.value = v; loadList(); return }
  // 2026-11-03 主人：简化。之前选完日期被强制接着弹「开始时间」「结束时间」两个选择器；现在日期归日期，时刻在表里各自一个按钮
  f.value.taskDate = v
}

// ---------------- s=3 / s=4 详情 ----------------
const t = ref(null)
async function openById(id, fromLink = false) {
  try {
    t.value = (await apiTask(id)).data
    const mine = t.value.mine
    // 消息里的任务链接不带门店和周次：回到列表时看的应是这条任务所在的门店和那一周
    // （之前列表固定显示下周，本周的任务在列表里找不到，验收完刷新也看不到它）
    if (fromLink) {
      storeId.value = t.value.storeId || storeId.value
      if (t.value.taskDate) weekStart.value = String(t.value.taskDate).slice(0, 10)
    }
    if (mine && mine.status === 'done') s.value = 4
    // 发布人自己没接这个任务时打开发布人菜单（验收 / 执行情况 / 取消），与列表里点任务一致。
    // 之前先判 canClaim：主理人也算本店员工，开放给换工的任务对他 canClaim 为真，
    // 点「任务有人认领」消息进来落到认领页，验收入口打不开
    else if (t.value.canPublish && !(mine && mine.status !== 'cancelled')) { s.value = 1; await loadList(); publisherMenu(t.value) }
    else s.value = 3
  } catch (e) {
    toast(errText(e, '任务不存在'))
    s.value = 1
    loadList()
  }
}
async function openTask(item) {
  if (!item.taskId) return
  if (list.value.canPublish) {
    try {
      const d = (await apiTask(item.taskId)).data
      if (d.mine && d.mine.status !== 'cancelled') { t.value = d; s.value = d.mine.status === 'done' ? 4 : 3; return }
      return publisherMenu(d)
    } catch (e) {
      return toast(errText(e, '任务不存在'))
    }
  }
  openById(item.taskId)
}
async function publisherMenu(d) {
  const people = (d.assignees || []).map(a => `${a.nickname || '用户' + a.userId}：${a.statusText}${a.points ? ' · ' + a.points + ' 积分' : ''}`).join('\n') || '还没有人认领 / 接受'
  // 草稿可以删除：之前草稿只能编辑发布，「生成改进计划」多点几次堆出来的重复草稿删不掉
  const opts = d.status === 'draft' ? ['编辑并发布', '查看执行情况', '删除草稿'] : ['验收接单人', '查看执行情况', '取消任务']
  const i = await sheet(opts)
  if (i < 0) return
  const op = opts[i]
  if (op === '查看执行情况') return alert(d.title, `${d.timeText}\n${d.place}\n\n${people}`)
  if (op === '编辑并发布') {
    // 2026-11-03 复查：草稿缺原始日期时 formFromTask 会报错，之前没接住、页面没反应；现在用提示说出来
    try { fillForm(d) } catch (e) { return toast(e.message || '草稿读取失败，请刷新后再编辑') }
    tried.value = false
    return (s.value = 2)
  }
  if (op === '删除草稿') {
    if (!(await confirm('删除草稿', `删除「${d.title}」这条草稿？删除后不能恢复。`)) || busy) return
    busy = true
    try {
      await apiTaskCancel(d.taskId, '')
      toast('草稿已删除')
      loadList()
    } catch (e) {
      toast(errText(e, '删除失败'))
    } finally {
      busy = false
    }
    return
  }
  if (op === '取消任务') {
    const reason = await prompt('取消原因（会通知接单人）', { placeholder: '选填' })
    if (reason === null || busy) return
    busy = true
    try {
      await apiTaskCancel(d.taskId, reason)
      toast('任务已取消')
      loadList()
    } catch (e) {
      toast(errText(e, '取消失败'))
    } finally {
      busy = false
    }
    return
  }
  openCheck(d)
}
// ---------------- 验收面板 ----------------
// 2026-11-03 主人：简化验收。原来「选人 → 填工时 → 选星 → 写评语 → 问传不传凭证 → （传失败再问一次）」5–6 个系统弹窗，一步错了从头来；
// 现在一个底部面板一次填完，只在结算前确认一次（积分一发就收不回）。提交给服务端的内容和原来一样：userId、hours、rating、comment、proofs
const checkPop = ref(null)
const checkUploading = ref(false)
const checkErrKeys = computed(() => (checkPop.value ? Object.keys(checkErrors(checkPop.value)) : []))
const checkTodo = computed(() => (checkPop.value ? checkTodoText(checkPop.value) : ''))
function openCheck(d) {
  const c = blankCheck(d)
  if (!c.people.length) return toast('没有进行中的接单人')
  checkPop.value = c
}
function closeCheck() {
  if (checkUploading.value) return toast('凭证还在上传，稍等一下')
  checkPop.value = null
  editing.value = ''
}
// 凭证照片（选填，最多 6 张）：选了就传，传上的立刻显示在面板里，没传上的说一声，不再用确认框问「还要不要验收」
async function addProofs() {
  const c = checkPop.value
  if (!c || checkUploading.value) return
  const paths = await chooseImages(CHECK_PROOF_MAX - c.proofs.length)
  if (!paths.length) return
  checkUploading.value = true
  let failed = 0
  try {
    for (const p of paths.slice(0, CHECK_PROOF_MAX - c.proofs.length)) {
      try {
        c.proofs.push((await uploadTo('/app/upload/image', p)).data.url)
      } catch (e) {
        failed++
      }
    }
  } finally {
    checkUploading.value = false
  }
  if (failed) toast(`有 ${failed} 张照片没传上去，可以再点「添加」试一次`)
}
const removeProof = (i) => { if (checkPop.value) checkPop.value.proofs.splice(i, 1) }
async function submitCheck() {
  const c = checkPop.value
  if (!c) return
  if (checkUploading.value) return toast('凭证还在上传，稍等一下')
  if (checkErrKeys.value.length) return toast(checkTodoText(c))
  // 涉及结算（发积分）：这一次确认保留
  if (!(await confirm('验收通过', checkConfirmText(c))) || busy) return
  busy = true
  try {
    const payload = checkPayload(c)
    await apiTaskCheck(c.taskId, payload)
    checkPop.value = null
    editing.value = ''
    toast(payload.proofs.length ? `已验收，凭证 ${payload.proofs.length} 张，积分已发放` : '已验收，积分已发放')
    loadList()
  } catch (e) {
    toast(errText(e, '验收失败'))
  } finally {
    busy = false
  }
}
const ICONS = ['camera', 'mouse-pointer-click', 'boxes', 'messages-square']
const permissions = computed(() => {
  const list = ((t.value && t.value.scope) || []).map((x, i) => ({ icon: ICONS[i % 4], text: x }))
  return list.length ? list : [{ icon: ICONS[0], text: '按门店现场安排参与，具体分工以带教说明为准' }]
})
const mine = computed(() => (t.value && t.value.mine) || null)
const claimed = computed(() => !!(mine.value && mine.value.status === 'accepted'))
const bannerTitle = computed(() => (mine.value && mine.value.source === 'assigned' ? '已接受任务！' : '认领成功！'))
async function claim() {
  if (!t.value) return (s.value = 1)
  if (claimed.value) return (s.value = 1)
  if (!t.value.canClaim) return toast(claimBlocked(t.value))
  if (busy) return
  busy = true
  try {
    t.value = (await apiTaskClaim(t.value.taskId)).data
    toast(bannerTitle.value.replace('！', ''))
  } catch (e) {
    toast(errText(e, '认领失败'))
  } finally {
    busy = false
  }
}
// 之前不能认领时除「任务已取消」外一律提示「当前不能认领」，不说为什么；原因都在任务数据里（口径同 KgTaskService.claim）
function claimBlocked(x) {
  if (x.status === 'cancelled') return '任务已取消'
  if (x.status !== 'published') return '任务还没发布'
  const end = new Date(String(x.taskDate || '').slice(0, 10) + 'T' + String(x.endTime || '23:59').slice(0, 5) + ':00')
  if (!isNaN(end.getTime()) && end < new Date()) return '任务已结束，不能再认领'
  if (x.assignMode !== 'volunteer') return '这是指定员工的任务，只有被指定的员工可以接受'
  return '只有近 90 天在这家店入职的换工或本店员工可以认领'
}
async function unclaim() {
  if (!claimed.value && t.value && t.value.canDecline) return decline()
  if (!claimed.value) return (s.value = 1)
  if (!t.value.canUnclaim) return toast('开始前 2 小时内不能取消，请直接联系门店')
  if (!(await confirm('取消认领', '确认取消？名额会释放给其他人。')) || busy) return
  busy = true
  try {
    t.value = (await apiTaskUnclaim(t.value.taskId)).data
    toast('已取消')
    s.value = 1
  } catch (e) {
    toast(errText(e, '取消失败'))
  } finally {
    busy = false
  }
}
// 被指定的员工做不了：写一句原因（选填）告诉发布人，这条指派作废；之前只能「返回列表」，发布人一直等不到回音
async function decline() {
  const reason = await prompt('无法参加（会通知发布人）', { placeholder: '选填，例如：当天要值夜班' })
  if (reason === null || busy) return
  busy = true
  try {
    await apiTaskDecline(t.value.taskId, reason.trim().slice(0, 100))
    toast('已告诉发布人')
    s.value = 1
  } catch (e) {
    toast(errText(e, '提交失败'))
  } finally {
    busy = false
  }
}
const checkerAvatar = computed(() => (mine.value && mine.value.checkedAvatar ? absUrl(mine.value.checkedAvatar) : DEFAULT_AVATAR))
const ratingNum = computed(() => Number((mine.value && mine.value.rating) || 0))
const viewProofs = () => (mine.value && mine.value.proofs && mine.value.proofs.length ? uni.previewImage({ urls: mine.value.proofs.map(absUrl) }) : toast('验收时没有上传凭证'))
// 申报页在员工端：没有员工授权的换工点了会被送去员工入口，改成说清楚找谁
const appeal = () => (hasStaffAccess.value ? go(R.honor + '?view=appeal') : alert('对验收有疑问', '请直接联系这家门店的主理人或管家沟通。'))
const openResume = () => go(R.resume + '?s=4')

// ---------------- s=2 发布 ----------------
// 2026-11-03 主人：简化。表单规则（空表、从草稿回填、还差什么、加减号、技能、提交内容）都在 tasks-form.js；这里只管页面状态
const blank = () => blankTask(shiftDate(todayCn(), 1))
const f = ref(blank())
const fillForm = (d) => { f.value = formFromTask(d, shiftDate(todayCn(), 1)) }
const cnt = (v) => Array.from(String(v || '')).length
const scopeCount = computed(() => splitScope(f.value.scopeText).length)
// 正在输入的那个大段文字框（小程序 textarea 是原生层，会盖住日历和底部面板：不在输入时换成同样外观的 view，同 reimburse.vue）
const editing = ref('')
// 点过「发布」才把漏填的标红、底栏那一行变红；底栏的「还差：…」一直都在
const tried = ref(false)
const errs = computed(() => (tried.value ? taskErrors(f.value, true) : {}))
const errKeys = computed(() => taskErrKeys(f.value, true))
const todoText = computed(() => taskTodoText(f.value, true))
const dateText = computed(() => taskDateText(f.value.taskDate))
// 技能：页面内一个输入框 + 「添加」，点已加的技能删掉（原来是「菜单 → 系统弹窗」）
const skillDraft = ref('')
function pushSkill() {
  const r = addSkill(f.value.skills, skillDraft.value)
  if (r.error) return toast(r.error)
  f.value.skills = r.skills
  skillDraft.value = ''
}
// 在上次的选择上接着改；只有点「确定」才生效，中途关掉保留原来的人选和分配方式
const staffPop = ref(null)
async function pickStaff() {
  try {
    const staff = (await apiTaskStaff(storeId.value || undefined)).data || []
    if (!staff.length) return toast('本店还没有员工')
    staffPop.value = { list: staff, draft: f.value.mode === 'staff' ? [...f.value.assignees] : [] }
  } catch (e) {
    toast(errText(e, '员工加载失败'))
  }
}
const staffPicked = (u) => !!staffPop.value && staffPop.value.draft.some(x => String(x) === String(u.userId))
function toggleStaff(u) {
  const p = staffPop.value
  if (!p) return
  const at = p.draft.findIndex(x => String(x) === String(u.userId))
  if (at >= 0) p.draft.splice(at, 1)
  else if (p.draft.length >= 5) toast('最多指定 5 人')
  else p.draft.push(u.userId)
}
function confirmStaff() {
  const p = staffPop.value
  staffPop.value = null
  if (!p) return
  const byId = (id) => p.list.find(x => String(x.userId) === String(id)) || {}
  f.value.mode = 'staff'
  f.value.assignees = [...p.draft]
  f.value.assigneeNames = p.draft.map(id => byId(id).nickname || '用户' + id)
}
// 发布 / 认领 / 取消 / 验收都是写请求：网络慢时连点会重复提交（发布两条一样的任务）
let busy = false
// 存草稿只要标题；发布还要指定员工时有人、结束晚于开始。漏了就标红、底栏说清楚，不弹确认框
async function save(publish) {
  const x = f.value
  const e = taskErrors(x, publish)
  if (Object.keys(e).length) { tried.value = true; return toast(taskTodoText(x, publish)) }
  if (busy) return
  busy = true
  try {
    const res = await apiTaskSave(taskPayload(x, storeId.value, publish))
    toast((res.data && res.data.message) || '已保存')
    f.value = blank()
    tried.value = false
    weekStart.value = x.taskDate
    s.value = 1
  } catch (e) {
    toast(errText(e, '保存失败'))
  } finally {
    busy = false
  }
}
</script>

<style scoped lang="scss">
/* 填写页共用样式（输入框、平排方块、加减号、照片格、底栏）：2026-11-03 发布表单改成一张表直接填后和员工端其他填写页一个样子 */
@import '../staff/form-clean.scss';
.section-title { display: block; font-family: var(--k-serif); font-size: 17px; font-weight: 700; line-height: 1.25; }
.week-nav { display: flex; align-items: center; justify-content: center; gap: 18px; margin: 0 0 12px; }
.week-arrow { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; margin: 0 -8px; }
.week-box { width: 230px; height: 36px; padding: 0 14px; border: 1px solid var(--k-line2); border-radius: 9px; background: var(--k-paper); display: flex; align-items: center; justify-content: space-between; font-family: var(--k-serif); font-size: 16px; font-weight: 700; }
.status-tabs { display: flex; height: 40px; margin-bottom: 18px; border: 1px solid var(--k-line2); border-radius: 10px; background: var(--k-paper); overflow: hidden; }
.status-tabs__item { flex: 1; display: flex; align-items: center; justify-content: center; gap: 12px; border-left: 1px solid var(--k-line); font-size: 15px; }
.status-tabs__item:first-child { border-left: 0; }
.status-tabs__item.active { color: #fff; background: var(--k-red); font-weight: 600; }
.publish-link { display: flex; align-items: center; gap: 3px; color: var(--k-red); font-size: 14px; }
.task-card { margin-top: 8px; border: 1px solid var(--k-line); border-radius: 11px; background: var(--k-paper); overflow: hidden; }
.task-row { position: relative; min-height: 75px; padding: 9px 10px 8px 48px; border-top: 1px solid var(--k-line); display: flex; align-items: flex-start; gap: 10px; }
.task-row:first-child { border-top: 0; }
.task-row__avatar { position: absolute; left: 10px; top: 9px; width: 30px; height: 30px; border-radius: 50%; }
.task-row__check { position: absolute; left: 17px; top: 49px; width: 15px; height: 15px; border: 1.5px solid var(--k-line2); border-radius: 50%; }
.task-row__main { min-width: 0; flex: 1; padding-right: 60px; display: flex; flex-direction: column; }
.task-row__owner { font-size: 12px; color: var(--k-muted); line-height: 1.2; }
.task-row__title { margin-top: 6px; font-family: var(--k-serif); font-weight: 700; font-size: 16px; line-height: 1.25; }
.task-row__title--solo { margin-top: 4px; }
.task-row__meta { display: flex; align-items: center; gap: 7px; margin-top: 6px; color: var(--k-muted); font-size: 12px; white-space: nowrap; }
.task-row__place { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.priority { position: absolute; right: 10px; top: 9px; height: 24px; padding: 0 8px; border-radius: 6px; display: flex; align-items: center; font-size: 12px; font-weight: 600; }
.priority--high { color: var(--k-red); background: var(--k-red-soft); }
.priority--medium { color: #946620; background: var(--k-ochre-soft); }
.priority--low { color: var(--k-green); background: var(--k-green-soft); }
.task-more { height: 36px; border-top: 1px solid var(--k-line); display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 13px; }
.duty-title { margin-top: 16px; }
.vol-tip { display: block; margin-top: 6px; color: var(--k-muted); font-size: 12px; line-height: 1.6; }
.task-row--volunteer { min-height: 82px; }
.task-row--volunteer .task-row__title { margin-top: 0; }
.claimed { margin-top: 5px; color: var(--k-muted); font-size: 12px; }
.claimed__num { color: var(--k-red); font-weight: 700; }
/* 看的人自己在这条任务里的状态（我已认领 / 待我接受 / 我已完成） */
.mine-tag { margin-left: 8px; color: var(--k-green); font-weight: 700; }
.mine-line { margin-top: 5px; color: var(--k-green); font-size: 12px; font-weight: 700; }

/* 2026-11-03 主人：简化发布 / 验收。发布表单用填写页共用样式 pages/staff/form-clean.scss（编译时并进本页 wxss，不进主包）；
   下面只补本页独有的：技能的「输入框 + 添加」、底栏「还差什么」那一行、验收面板。守 form-clean 那几条：--k-* 颜色、强调色只用 --k-red-deep、能点的不低于 44、圆角 8/12/16 */
.skill-add { display: flex; align-items: center; gap: 8px; }
.skill-add__input { flex: 1; min-width: 0; }
.skill-add__btn { flex-shrink: 0; min-width: 72px; height: 48px; padding: 0 16px; box-sizing: border-box; border-radius: 12px; background: var(--k-paper2); display: flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 500; color: var(--k-red-deep); }
.fc-bar__todo { display: flex; align-items: center; justify-content: center; min-height: 44px; margin-top: -8px; padding: 0 4px; font-size: 14px; line-height: 20px; text-align: center; color: var(--k-red-deep); }
.fc-bar__todo--err { color: var(--k-alert); }
.fc-bar__todo--ok { color: var(--k-muted); }
/* 「还差」一行可能折两行：底部多留 20 */
.fc-form { padding-bottom: calc(128px + var(--k-safe-bottom)); }
.check-pop__scroll { max-height: 62vh; margin: 12px 0 12px; }
/* 「验收谁」的人名方块：和指定员工弹框共用样式，这里加高到 44 够手指点 */
.check-pop__sec .chip-pop__chip { padding: 12px 14px; }
.check-pop__sec { padding: 10px 0 12px; }
.check-pop__row { display: flex; align-items: center; gap: 8px; }
.check-pop__k { display: block; margin-bottom: 10px; font-size: 16px; font-weight: 500; line-height: 24px; color: var(--k-ink); }
.check-pop__row .check-pop__k { margin-bottom: 0; flex-shrink: 0; }
.check-pop__hours { box-sizing: border-box; width: 72px; height: 44px; text-align: center; font-size: 16px; font-weight: 600; color: var(--k-ink); }
.check-pop__unit { font-size: 16px; color: var(--k-ink2); }
.check-pop__stars { display: flex; align-items: center; gap: 2px; }
.check-pop__star { width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; }
.check-pop__star-label { margin-left: 8px; font-size: 15px; color: var(--k-ink2); }
.check-pop__foot { display: block; }
.check-pop__todo { display: block; min-height: 24px; margin-bottom: 8px; text-align: center; font-size: 14px; line-height: 24px; color: var(--k-muted); }
.check-pop__todo--err { color: var(--k-alert); }
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
.info-card__title { min-width: 0; font-family: var(--k-serif); font-weight: 700; font-size: 16px; }
.info-card__chip { flex-shrink: 0; margin-left: 8px; }
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
.covenant { min-height: 36px; margin-top: 9px; padding: 8px 10px; border: 1px solid var(--k-line); border-radius: 8px; background: var(--k-paper2); display: flex; align-items: center; color: var(--k-muted); font-size: 12px; }
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
.stars text { margin-left: 8px; font-family: var(--k-sans); font-size: 18px; font-weight: 700; }
.review-card__text { display: block; margin-top: 8px; color: var(--k-muted); font-size: 13px; }
.hours { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 7px; }
.hours__card { height: 66px; padding: 10px 12px; border: 1px solid var(--k-line); border-radius: 10px; background: var(--k-paper); font-size: 13px; }
.hours__num { display: inline-block; margin-top: 5px; font-family: var(--k-sans); font-size: 24px; }
.resume-row { height: 44px; margin-top: 7px; padding: 0 12px; border: 1px solid var(--k-line); border-radius: 9px; background: var(--k-paper); display: flex; align-items: center; gap: 8px; font-size: 13px; }
.resume-row__icon { width: 22px; height: 26px; border-radius: 5px; background: #8C8FA6; display: flex; align-items: center; justify-content: center; }
.done-actions { margin-top: 14px; }
.chip-pop { position: fixed; inset: 0; z-index: 1000; }
.chip-pop__mask { position: absolute; inset: 0; background: rgba(36,27,23,.45); }
.chip-pop__panel { position: absolute; left: 0; right: 0; bottom: 0; padding: 18px 16px calc(16px + var(--k-safe-bottom)); border-radius: 20px 20px 0 0; background: var(--k-paper); }
.chip-pop__head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.chip-pop__title { font-family: var(--k-serif); font-size: 18px; font-weight: 700; }
.chip-pop__hint { color: var(--k-muted); font-size: 13px; }
.chip-pop__scroll { max-height: 50vh; margin: 16px 0 20px; }
.chip-pop__chips { display: flex; flex-wrap: wrap; gap: 10px; }
/* 2026-11-03 复查：指定员工 / 验收谁的名字方块原来 36 高，老年用户不好点，补到 44（同 form-clean 的最小点击高度） */
.chip-pop__chip { box-sizing: border-box; min-height: 44px; padding: 11px 14px; border: 1px solid var(--k-line); border-radius: 22px; font-size: 15px; line-height: 20px; background: var(--k-bg); }
.chip-pop__chip.on { color: #fff; border-color: var(--k-red); background: var(--k-red); font-weight: 600; }
.chip-pop__foot { display: flex; gap: 12px; }
.chip-pop__btn { flex: 1; min-width: 0; }
.chip-pop__btn--main { flex: 2; }
</style>
