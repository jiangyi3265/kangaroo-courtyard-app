<template>
  <view class="task-entry" hover-class="k-press" @click="go(STAFF_TASK_PAGE)">
    <view class="task-entry__copy"><text class="task-entry__title">管理员任务</text><text class="task-entry__sub">接收任务、回复提问、提交完成情况</text></view>
    <text v-if="staffTaskTodoCount" class="task-entry__count">{{ staffTaskTodoCount }} 项待办</text>
    <k-icon name="chevron-right" :size="18" color="muted" />
  </view>
</template>

<script setup>
// 主人 2026-11-03：任务能发给全体员工、按岗位发。线上专员、商家服务人、城市负责人的工作台也要有「管理员任务」入口（换工主理人、小院主理人的在 pages/staff/index 里）。
// 放在 staff 分包里，页面显式引入，不走全局 easycom；待办数由工作台 onShow 里的 checkStaffTaskReminder 刷新
import { STAFF_TASK_PAGE, staffTaskTodoCount } from '@/common/staff-task-reminder.js'
import { go } from '@/common/screen.js'

defineOptions({ options: { virtualHost: true, styleIsolation: 'apply-shared' } })
</script>

<style scoped>
.task-entry{display:flex;align-items:center;gap:10px;padding:14px;margin:14px 0 4px;border:1px solid var(--k-line);border-radius:12px;background:var(--k-paper)}
.task-entry__copy{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}
.task-entry__title{font-size:15px;font-weight:700;color:var(--k-ink)}
.task-entry__sub{font-size:12px;color:var(--k-muted)}
.task-entry__count{color:var(--k-red);font-size:13px;white-space:nowrap}
</style>
