<template>
  <!-- #ifdef MP-WEIXIN -->
  <page-meta :page-style="s === 2 && typeSheet ? 'overflow: hidden' : ''" />
  <!-- page-meta 必须是页面第一个节点。活动类型弹层开着时锁住页面滚动（弹框里的 scroll-view 不能用 catchtouchmove 拦，拦了它自己也滑不动）。
       只在小程序里加：H5 的 page-meta 关弹窗时清不掉这条样式（H5 用 lockPageScroll 锁 body） -->
  <!-- #endif -->
  <view class="k-page act">
    <k-topbar :title="s === 2 && editId ? '修改活动' : titles[s - 1]" back custom-back :fab="s !== 2" @back="onBack" />

    <!-- 1 活动列表 -->
    <view v-if="s === 1" class="pad-both">
      <!-- 2026-11-03 主人：简化列表。「筛选」按钮和下面三个下拉是同一件事，去掉；商家只留 4 个页签（本店活动没有「来源」可选，状态就是页签），
           员工留 来源 / 状态 / 排序 三个下拉 -->
      <view class="k-body search-row">
        <view class="search"><k-icon name="search" :size="16" color="light" :stroke="1.8" /><input v-model="kw" confirm-type="search" placeholder="搜索活动名称、地点、发起人" placeholder-class="k-placeholder" @confirm="loadList" /></view>
      </view>
      <view class="tabs">
        <view v-for="t in listTabs" :key="t" class="tabs__item" :class="{ active: tab === t }" @click="setTab(t)"><text>{{ t }}</text></view>
      </view>
      <view v-if="pills.length" class="pills">
        <view v-for="(p, pi) in pills" :key="pi" class="pill" @click="pickPill(pi)"><text>{{ p }}</text><k-icon name="chevron-down" :size="13" color="ink" :stroke="1.8" /></view>
      </view>
      <view class="list">
        <view v-for="(a, i) in activities" :key="a.activityId" class="item" @click="openDetail(a.activityId)">
          <image class="item__img" :src="a.img" mode="aspectFill" />
          <view class="k-flex1">
            <view class="k-row k-gap8"><view class="tag" :class="`tag--${a.tone}`"><text>{{ a.status }}</text></view><text class="item__title k-ellipsis">{{ a.title }}</text></view>
            <view class="item__meta"><text class="item__src">来 源：{{ a.source || '—' }}</text><view class="vline" /><text class="item__owner">发起人：{{ a.owner || '—' }}</text></view>
            <view class="item__line"><k-icon name="user-round" :size="14" color="muted" :stroke="1.6" /><text>报名 {{ a.count }}</text><text v-if="a.priceText" class="item__price">{{ a.feeKind === 'paid' ? a.priceText + '/人' : a.priceText }}</text></view>
            <view class="item__line"><k-icon name="calendar" :size="14" color="muted" :stroke="1.6" /><text>{{ a.time }}</text></view>
            <view class="item__line k-between"><view class="k-row k-gap6 item__place"><k-icon name="map-pin" :size="14" color="muted" :stroke="1.6" /><text class="k-ellipsis">{{ a.place }}</text></view><view class="audit" :class="`audit--${a.auditTone}`"><text>{{ a.audit }}</text></view></view>
          </view>
        </view>
      </view>
      <view class="act-bar"><k-button block icon="plus" @click="newActivity" :label="createLabel" /></view>
      <k-tabbar mode="staff" active="work" />
    </view>

    <!-- 2 创建活动（2026-10-31 R7 改版，主人：看起来很乱，用的人有年龄大的，要干净成熟）：一组一块通栏白底，样式 form-clean.scss。字段一个没少；活动字段少，不折叠。
         标题、地点没填就地标红（aerr），校验规则和原来一样 -->
    <template v-else-if="s === 2">
      <view class="fc-form">
        <view class="fc-block">
          <text class="fc-group__title">基本信息</text>
          <view class="fc-field"><text class="fc-label__t">发布内容</text><view class="fc-seg"><view class="fc-seg__item" :class="{on:productKind==='activity'}" hover-class="k-press" @click="productKind='activity'">社区活动</view><view class="fc-seg__item" :class="{on:productKind==='travel'}" hover-class="k-press" @click="productKind='travel'">旅游产品</view></view><text v-if="productKind==='travel'" class="fc-note">审核通过后展示在旅居页的旅游产品中。介绍里请写明行程、费用包含和退改安排。</text></view>
          <view class="fc-row" hover-class="k-press" @click="typeSheet = true"><text class="fc-row__k">活动类型</text><text class="fc-row__v">{{ type }}</text><k-icon name="chevron-right" :size="18" color="muted" /></view>
          <view class="fc-field">
            <view class="fc-label"><text class="fc-label__t">活动封面</text></view>
            <view class="fc-cover-row"><view class="fc-cover" hover-class="k-press-s" @click="pickCover"><image v-if="cover" class="fc-photo__img" :src="coverImg" mode="aspectFit" /><text v-if="cover" class="fc-photo__tag">封面</text><view v-else class="fc-photo__add"><k-icon name="plus" :size="24" color="ink2" :stroke="1.8" /><text>上传</text></view></view><text class="fc-note">横图、竖图都可以，整张显示不裁剪</text></view>
          </view>
          <!-- 活动介绍（kg_activity.intro，最多 1000 字）：用户在活动详情「活动介绍」里看到，保留换行。2026-11-03 主人：「活动介绍放到活动标题上面」。
               小程序 textarea 是原生层、会盖住底部按钮和弹层：不在输入时换成同样外观的 view，点了才换回输入框。
               不限输入长度（写 1000 的话粘贴超长会被悄悄截掉），超过 1000 字时字数变红，提交前拦下并说明 -->
          <view id="af-intro" class="fc-field">
            <view class="fc-label"><text class="fc-label__t">活动介绍</text></view>
            <textarea v-if="editingIntro" v-model="intro" :maxlength="-1" :placeholder="INTRO_HINT" class="fc-area" placeholder-class="fc-ph" :focus="true" auto-focus @blur="intro = $event.detail.value; editingIntro = false" />
            <view v-else class="fc-area fc-area--idle" hover-class="k-press" @click="editingIntro = true"><text :class="{ 'fc-ph': !intro }">{{ intro || INTRO_HINT }}</text></view>
            <view class="fc-foot fc-foot--end"><text class="fc-count" :class="{ 'k-alert': intro.trim().length > INTRO_MAX }">{{ intro.trim().length }}/{{ INTRO_MAX }}</text></view>
          </view>
          <view id="af-title" class="fc-field">
            <view class="fc-label"><text class="fc-label__t">活动标题</text><text class="fc-req">必填</text><text class="fc-count">{{ title.length }}/30</text></view>
            <input v-model="title" class="fc-input" :class="{ 'fc-input--err': aerr.title }" maxlength="30" placeholder="请输入活动标题" placeholder-class="fc-ph" />
            <text v-if="aerr.title" class="fc-err">{{ aerr.title }}</text>
          </view>
        </view>
        <view class="fc-block">
          <text class="fc-group__title">时间与地点</text>
          <!-- 2026-11-03 主人：「选择时间，同时选择」。点一下出一个滚轮，日期 | 时 | 分一起选；结束时间默认开始后 3 小时，自己改过的就不跟着动 -->
          <view id="af-when" class="fc-row"><text class="fc-row__k">开始时间</text><view class="fc-when"><picker mode="multiSelector" :range="when.cols" :value="whenIndex(start, when.dates)" @change="setWhen('start', $event)"><view class="fc-pick" hover-class="k-press-s"><text class="fc-pick__t">{{ whenLabel(start) }}</text></view></picker></view></view>
          <view class="fc-row"><text class="fc-row__k">结束时间</text><view class="fc-when"><picker mode="multiSelector" :range="when.cols" :value="whenIndex(end, when.dates)" @change="setWhen('end', $event)"><view class="fc-pick" hover-class="k-press-s"><text class="fc-pick__t">{{ whenLabel(end) }}</text></view></picker></view></view>
          <!-- 2026-11-03 主人：活动地点和地图位置合成一行。点了打开微信地图选点，地点名称、地址、地图位置一次填好（报名的人在活动详情点「集合」能导航）；
               选好后再点可以只改名称文字、重新选点或清掉地图位置。网页版没有地图，直接填文字 -->
          <view id="af-place" class="fc-row" :class="{ 'fc-row--err': aerr.place }" hover-class="k-press" @click="pickPlace"><view class="fc-row__copy fc-row__copy--fit"><view class="fc-row__head"><text class="fc-row__k">活动地点</text><text class="fc-req">必填</text></view><text class="fc-row__sub">{{ meet ? '已标地图位置' : '可在地图上选' }}</text><text v-if="aerr.place" class="fc-err">{{ aerr.place }}</text></view><text class="fc-row__v fc-row__v--full" :class="{ 'fc-row__v--empty': !place }">{{ place || '点击在地图上选' }}</text><k-icon name="map-pin" :size="18" color="muted" /></view>
        </view>
        <view class="fc-block">
          <text class="fc-group__title">人数与费用</text>
          <view class="fc-row"><view class="fc-row__copy"><text class="fc-row__k">招募人数</text><text class="fc-row__sub">最多 50 人</text></view><view class="fc-num"><input v-model="people" class="fc-num__input" type="number" maxlength="2" /><text class="fc-num__unit">人</text></view></view>
          <!-- 2026-11-03 主人：「价格，免费，aa制三种付费方式」。三个大按钮：收费才填每人费用（必填，大于 0）；AA制 = 现场由参加的人平摊，平台不收钱，可填预估人均和分摊什么 -->
          <view id="af-fee" class="fc-field">
            <view class="fc-label"><text class="fc-label__t">费用设置</text></view>
            <view class="fc-seg fc-seg--3"><view v-for="k in FEE_KINDS" :key="k[0]" class="fc-seg__item" :class="{ on: feeKind === k[0] }" hover-class="k-press" @click="feeKind = k[0]"><text>{{ k[1] }}</text></view></view>
            <view v-if="feeKind === 'paid'" class="fc-gap"><view class="fc-money" :class="{ 'fc-money--err': aerr.fee }"><text class="fc-money__sign">¥</text><input v-model="fee" class="fc-money__input" type="digit" maxlength="8" placeholder="每人费用，例如 88" placeholder-class="fc-ph" /><text class="fc-money__unit">元/人</text></view></view>
            <view v-if="feeKind === 'aa'" class="fc-gap"><view class="fc-money" :class="{ 'fc-money--err': aerr.fee }"><text class="fc-money__sign">约 ¥</text><input v-model="aaFee" class="fc-money__input" type="digit" maxlength="8" placeholder="预估人均（选填）" placeholder-class="fc-ph" /><text class="fc-money__unit">元/人</text></view></view>
            <view v-if="feeKind === 'aa'" class="fc-gap"><input v-model="aaNote" class="fc-input" maxlength="40" placeholder="AA 包含什么（选填），例如：门票、拼车油费" placeholder-class="fc-ph" /></view>
            <text v-if="aerr.fee" class="fc-err">{{ aerr.fee }}</text>
            <text v-else class="fc-note">{{ feeHint }}</text>
          </view>
        </view>
      </view>
      <!-- 2026-11-03 主人：简化提交。按钮上面一行一直写着还差什么（和招募表 jobs.vue 一样），点了标红并滚到第一项；都填好了写「可以提交」。
           点「提交发布」不再多问一次「确认提交？」：这一行就是确认 -->
      <view class="fc-bar"><view class="fc-bar__todo" :class="{ 'fc-bar__todo--err': tried && todoKeys.length, 'fc-bar__todo--ok': !todoKeys.length }" hover-class="k-press" @click="showTodo"><text>{{ todoText }}</text></view><view class="fc-bar__btns"><fc-kefu /><view class="fc-btn fc-btn--ghost" hover-class="k-press-s" @click="saveDraft"><text>保存草稿</text></view><view class="fc-btn" hover-class="k-press-s" @click="submit"><text>{{ editId ? '保存修改' : '提交发布' }}</text></view></view></view>
      <fc-sheet v-if="typeSheet" title="活动类型" :options="typeOptions" :value="type" @confirm="confirmType" @cancel="typeSheet = false" />
    </template>

    <!-- 3 报名数据 -->
    <view v-else-if="s === 3" class="k-body pad-both data-body">
      <view class="k-between k-gap10">
        <view class="select select--act" @click="pickActivity"><text class="k-ellipsis">{{ stat.title || d.title }}</text><k-icon name="chevron-down" :size="14" color="ink" :stroke="1.8" /></view>
        <view class="select select--date" @click="pickRange"><text>{{ stat.range || RANGES[range][0] }}</text><k-icon name="calendar" :size="15" color="ink" :stroke="1.6" /></view>
      </view>
      <view class="stats k-mt12">
        <view v-for="st in stats" :key="st.label" class="stat"><text class="stat__label">{{ st.label }}</text><text class="stat__num">{{ st.value }}</text><view class="k-row k-gap2"><text class="k-meta">较昨日</text><k-icon v-if="deltaDir(st.delta)" :name="deltaDir(st.delta) > 0 ? 'arrow-up' : 'arrow-down'" :size="11" :color="deltaDir(st.delta) > 0 ? 'green' : 'alert'" :stroke="2.4" /><text class="stat__delta" :style="deltaStyle(st.delta)">{{ st.delta || '—' }}</text></view></view>
      </view>
      <view class="k-divider k-mt14" />
      <text class="sec k-mt12">渠道来源</text>
      <view class="k-row k-gap16 k-mt10">
        <view class="donut" :style="{ background: donutBg }"><view class="donut__hole" /></view>
        <view class="k-flex1 legend">
          <view v-for="c in channels" :key="c.name" class="legend__row"><view class="legend__dot" :style="{ background: c.color }" /><text class="legend__name">{{ c.name }}</text><text class="legend__pct">{{ c.pct }}</text><text class="legend__num">{{ c.num }}</text></view>
        </view>
      </view>
      <text class="sec k-mt16">报名趋势</text>
      <view class="k-between k-mt6"><text class="k-meta">单位：人</text><view class="k-row k-gap14"><view class="k-row k-gap5"><view class="legend__dot" style="background:#4E8FC4" /><text class="k-small k-muted">浏览量</text></view><view class="k-row k-gap5"><view class="legend__dot" style="background:var(--k-green)" /><text class="k-small k-muted">报名数</text></view></view></view>
      <view class="chart">
        <view class="chart__y"><text v-for="(v, vi) in yAxis" :key="vi">{{ v }}</text></view>
        <view class="chart__plot">
          <view v-for="g in 5" :key="g" class="chart__grid" :style="{ top: ((g - 1) * 25) + '%' }" />
          <view class="chart__axis" />
          <view v-for="(seg, i) in viewSegs" :key="'v' + i" class="seg seg--blue" :style="seg" />
          <view v-for="(seg, i) in signSegs" :key="'g' + i" class="seg seg--green" :style="seg" />
          <view v-for="(p, i) in viewPts" :key="'vp' + i" class="pt pt--blue" :style="p" />
          <view v-for="(p, i) in signPts" :key="'gp' + i" class="pt pt--green" :style="p" />
        </view>
      </view>
      <view class="chart__x"><text v-for="(x, xi) in xDates" :key="xi">{{ x }}</text></view>
      <view class="k-row k-gap10 k-mt16 sums">
        <view class="sum sum--pair">
          <view class="sum__cell"><text class="sum__label">已确认</text><view class="k-row k-gap6 k-baseline"><text class="sum__num">{{ stat.confirmed || 0 }}</text><text class="k-small">人</text></view><text class="k-small k-muted k-mt6">占比 {{ stat.confirmedPct || '0%' }}</text></view>
          <view class="sum__cell sum__cell--line"><text class="sum__label">候补中</text><view class="k-row k-gap6 k-baseline"><text class="sum__num">{{ stat.waitlist || 0 }}</text><text class="k-small">人</text></view><text class="k-small k-muted k-mt6">占比 {{ stat.waitlistPct || '0%' }}</text></view>
        </view>
        <view class="sum"><view class="sum__cell"><text class="sum__label">已取消</text><view class="k-row k-gap6 k-baseline"><text class="sum__num">{{ stat.cancelled || 0 }}</text><text class="k-small">人</text></view><text class="k-small k-muted k-mt6">占比 {{ stat.cancelledPct || '0%' }}</text></view></view>
      </view>
      <view class="act-bar act-bar--two"><k-button type="outline" icon="images" class="btn-export" @click="exportList" label="导出名单" /><k-button class="k-flex1" @click="broadcast()" label="群发提醒" /></view>
      <k-tabbar mode="staff" active="work" />
    </view>

    <!-- 4 活动详情 -->
    <view v-else class="k-body k-pad-bottom">
      <view class="k-row-start k-gap12">
        <image class="d-cover" :src="d.img ? absUrl(d.img) : '/static/media/cover-empty.png'" mode="aspectFill" />
        <view class="k-flex1">
          <view class="tag tag--green" :class="'tag--' + dTone"><text>{{ d.phaseLabel || d.statusLabel }}</text></view>
          <text class="d-title">{{ d.title }}</text>
          <view class="d-line"><k-icon name="calendar" :size="15" color="ink" :stroke="1.6" /><text>{{ d.timeText }}</text></view>
          <view class="d-line"><k-icon name="map-pin" :size="15" color="ink" :stroke="1.6" /><text>{{ d.place }}</text></view>
          <view class="d-line"><k-icon name="map-pin" :size="15" color="ink" :stroke="1.6" /><text>发起人：{{ d.organizerName }}{{ d.status === 'pending' ? (merchantStaff ? '（待审核）' : '（待平台审核）') : '' }}</text></view>
        </view>
      </view>
      <!-- 被驳回：原因只发过一条消息，翻不到就不知道改什么。修改走下面的「修改活动」，保存后重新进入待审核 -->
      <view v-if="d.status === 'rejected' && d.auditReason" class="tips k-mt14">
        <text class="tips__title">驳回原因</text>
        <text class="tips__text">{{ d.auditReason }}</text>
        <text class="tips__text">请点下面的「修改活动」改好后再提交。</text>
      </view>
      <!-- 2026-11-03 主人：简化审核中的详情。待审核 / 被驳回时只给 状态 + 驳回原因 + 「修改活动」「联系客服」两个大按钮；
           6 格、异常天气处理、取消活动流程、底部暂停 / 结束都是审核通过后才用得上，这时不出现。商家、员工一样。
           联系客服：小程序里按钮直接拉起微信客服会话（open-type="contact"，和表单底部的客服方块一样），网页版进客服中心 -->
      <template v-if="underReview">
        <view class="tips k-mt14"><text class="tips__text">{{ reviewTip }}</text></view>
        <view class="rv-btns k-mt12">
          <view class="rv-btn" hover-class="k-press-s" @click="editActivity"><k-icon name="square-pen" :size="20" color="white" :stroke="1.8" /><text>修改活动</text></view>
          <!-- #ifdef MP-WEIXIN -->
          <button class="rv-btn rv-btn--ghost" open-type="contact" :session-from="kefuFrom" hover-class="k-press-s" aria-label="联系人工客服"><k-icon name="headset" :size="20" color="ink" :stroke="1.8" /><text>联系客服</text></button>
          <!-- #endif -->
          <!-- #ifndef MP-WEIXIN -->
          <view class="rv-btn rv-btn--ghost" hover-class="k-press-s" @click="contactSupport"><k-icon name="headset" :size="20" color="ink" :stroke="1.8" /><text>联系客服</text></view>
          <!-- #endif -->
        </view>
      </template>
      <template v-else>
      <view class="d-stats k-mt14">
        <view v-for="(st, i) in dStats" :key="st.label" class="d-stat" :class="{ line: i > 0 }"><text class="d-stat__label">{{ st.label }}</text><view class="k-row k-baseline"><text class="d-stat__num">{{ st.value }}</text><text v-if="st.sub" class="d-stat__sub">{{ st.sub }}</text></view></view>
      </view>
      <!-- 2026-11-03 主人：相册管理 + 更多设置 合成「修改活动」，活动群聊 + 成员管理 合成「成员与群聊」；8 格变 6 格（3×2），格子做大、字放大，年纪大的人看得清 -->
      <view class="grid k-mt12">
        <view v-for="(g, i) in actions" :key="g.title" class="grid__cell" hover-class="k-press" :class="{ 'grid__cell--r': i % 3 !== 2, 'grid__cell--b': i < actions.length - 3 }" @click="onAction(g)">
          <k-icon :name="g.icon" :size="36" color="ink" :stroke="1.5" />
          <text class="grid__title">{{ g.title }}</text>
          <text class="grid__sub">{{ g.sub }}</text>
        </view>
      </view>
      <view class="weather k-mt12">
        <k-icon name="sun" :size="20" color="ink" :stroke="1.5" />
        <text class="weather__text k-flex1">出发前请查看当地天气预报；\n遇到恶劣天气可一键通知全部成员</text>
        <view class="weather__btn" @click="weatherFlow"><text>异常天气处理</text></view>
      </view>
      <view class="tips k-mt12">
        <text class="tips__title">温馨提示</text>
        <text class="tips__text">{{ cancelTip }}</text>
        <view v-if="canCancel" class="k-between k-mt12" @click="cancelActivity"><text class="tips__link">取消活动流程</text><k-icon name="chevron-right" :size="16" color="ink" :stroke="1.6" /></view>
      </view>
      <k-bottom flat><k-button type="outline" class="btn-pause" @click="togglePause" :label="pauseLabel" /><k-button class="k-flex1" @click="endActivity" label="结束活动" /></k-bottom>
      </template>
    </view>
  </view>
</template>

<script setup>
import { groupChatEnabled } from '@/common/features.js'
// ---------------------------------------------------------------------------
// 活动运营（员工端）接入情况：
//   s=1 活动列表：本店活动（apiStaffActivities），页签 / 来源 / 排序 / 搜索
//   s=2 创建 / 修改：直营门店 = 小院活动（收费走在线支付），其他门店 = 商家活动（收费只能到场支付）；发布前要审核（小院活动平台审，商家活动本城商家服务人或平台审，所以商家看到的文字不写「平台」）
//   s=3 报名数据：浏览 / 报名 / 转化、渠道来源、每日趋势、报名结构（只统计小程序内真实行为）
//   s=4 活动详情：群聊、成员（查看电话留痕且限活动前后 24 小时）、签到、现场通知、退款审批、暂停 / 结束 / 取消
// 页面上没有天气数据来源，原"天气预警"改为如实提示 + 一键通知成员。
// ---------------------------------------------------------------------------
import { ref, computed, watch } from 'vue'
import { onHide, onUnload } from '@dcloudio/uni-app'
import { useScreen, go, back, toast } from '@/common/screen.js'
import {
  apiStaffActivities, apiStaffActivity, apiStaffCreateActivity, apiStaffEditActivity, apiStaffActivityData, apiStaffActivityAction,
  apiStaffActivityBroadcast, apiStaffActivityCheckin
} from '@/common/api.js'
import { ensureSession, hasStaffAccess, currentStaffStoreId, currentStaffStore, merchantStaff, experience } from '@/common/experience.js'
import { fabSessionFrom } from '@/common/support-fab.js'
import { errText, sheet, pickPaged, prompt, confirm, alert, modal, shiftDate, todayCn, copy, pad2 } from '@/common/ui.js'
import { uploadTo, chooseImage, absUrl } from '@/common/upload.js'
import R from '@/common/routes.js'
import { staffCan } from '@/common/staff-perms.js'
import { whenColumns, whenIndex, whenPicked, addHours, whenKey, feeError, feeBody, feeKindOf, yuanText } from '@/common/activity-form.js'
// 填写屏的底部弹层、操作条上的客服方块、滚到报错、锁背景：staff 分包里的，组件要显式引入，不走全局 easycom
import FcSheet from './components/fc-sheet.vue'
import FcKefu from './components/fc-kefu.vue'
import { scrollToField, lockPageScroll } from './fc-page.js'

let booting = true
// 消息 / 待办 / 评价里的「查看活动」直接打开详情（或报名数据）：那一屏的返回回到来源页
let landing = 1
const s = useScreen(4, {
  onLoad: async (q) => {
    await ensureSession()
    booting = false
    if (!hasStaffAccess.value) return
    // 工作台「发布 · 活动」、商家首页「发布活动」（request-view.js 的 ACTIVITY_CREATE_PAGE）：直接进创建屏，返回回来源页
    if (q?.create) { landing = 2; return newActivity() }
    if (Number(q?.id)) {
      await openDetail(Number(q.id), s.value === 3 ? 3 : 4)
      if (d.value.activityId) { landing = s.value; return }
      // 之前活动打不开（已删除 / 不是本人有权限的门店）时停在一张空白详情上，按钮全都点不动；现在回到活动列表
      if (s.value !== 1) { s.value = 1; return }
    }
    loadList()
  }
})
watch(s, (v) => { if (v === 1) landing = 1; if (!booting && v === 1) loadList() })
// 第 2 屏改已有活动时顶栏显示「修改活动」（模板里按 editId 判断），和底部「保存修改」对上
const titles = ['活动管理', '创建活动', '报名数据', '活动详情']
const fail = (e, d) => toast(errText(e, d))
const DEFAULT_IMG = '/static/media/cover-empty.png'

// ---------------- s=1 列表 ----------------
const kw = ref('')
const TABS = [['全部', 'all'], ['报名中', 'open'], ['进行中', 'ongoing'], ['已结束', 'ended']]
const tabIdx = ref(0)
const data = ref({ rows: [], counts: {} })
const listTabs = computed(() => TABS.map(t => `${t[0]} (${(data.value.counts || {})[t[1]] || 0})`))
const tab = computed(() => listTabs.value[tabIdx.value])
const setTab = (t) => { tabIdx.value = Math.max(0, listTabs.value.indexOf(t)); loadList() }
const SOURCES = [['全部来源', ''], ['小院活动', 'yard'], ['商家活动', 'merchant'], ['用户自发', 'user']]
const SORTS = [['时间排序', 'new'], ['时间正序', 'old'], ['报名人数', 'signed']]
const pf = ref({ source: 0, sort: 0 })
const listLoaded = ref(false)
// 2026-11-03 主人：简化。商家本店活动没有「来源」可选、状态就是上面的页签，所以商家不出下拉（模板按 pills.length 不画这一行）；员工留 来源 / 状态 / 排序 三个
const pills = computed(() => (merchantStaff.value ? [] : [SOURCES[pf.value.source][0], listTabs.value[tabIdx.value].split(' ')[0] === '全部' ? '全部状态' : TABS[tabIdx.value][0], SORTS[pf.value.sort][0]]))
async function pickPill(i) {
  if (i === 1) {
    const j = await sheet(TABS.map(t => t[0]))
    if (j >= 0) { tabIdx.value = j; loadList() }
    return
  }
  const opts = i === 0 ? SOURCES : SORTS
  const j = await sheet(opts.map(o => o[0]))
  if (j < 0) return
  pf.value[i === 0 ? 'source' : 'sort'] = j
  loadList()
}
async function loadList() {
  try {
    data.value = (await apiStaffActivities({ storeId: currentStaffStoreId(), tab: TABS[tabIdx.value][1], source: SOURCES[pf.value.source][1] || undefined,
      keyword: kw.value || undefined, sort: SORTS[pf.value.sort][1] })).data || data.value
    listLoaded.value = true
  } catch (e) {
    fail(e, '活动加载失败')
  }
}
const activities = computed(() => (data.value.rows || []).map((a, i) => ({
  ...a, img: a.img ? absUrl(a.img) : '/static/media/cover-empty.png', source: a.sourceLabel, count: a.countText, time: a.timeText
})))
// 列表为空时没有单独的空态块（加节点会动设计稿结构），就在底部「创建活动」按钮上说清楚：是本店还没有活动，还是筛选后没有
const createLabel = computed(() => {
  if (!listLoaded.value || activities.value.length) return '创建活动'
  return kw.value || tabIdx.value || pf.value.source ? '没有符合条件的活动 · 创建活动' : '暂无活动 · 创建第一个活动'
})

// ---------------- s=2 创建 / 修改 ----------------
// 2026-11-03 主人：活动类型「只留这四个」。老活动的「手作课程」「讲座沙龙」修改时照常显示、照原样保存，弹层里只给这四个
const types = ['生活体验', '小型聚会', '户外活动', '其他']
const type = ref('生活体验')
// 点了从底部弹层选（和之前一样）
const typeOptions = types.map(t => ({ label: t, value: t }))
const typeSheet = ref(false)
const confirmType = (v) => { typeSheet.value = false; type.value = v }
watch(typeSheet, (open) => lockPageScroll(open))
onHide(() => lockPageScroll(false))
onUnload(() => lockPageScroll(false))
const editId = ref(null)
const title = ref('')
const cover = ref('')
const coverImg = computed(() => (cover.value ? absUrl(cover.value) : '/static/media/cover-empty.png'))
const start = ref({ date: shiftDate(todayCn(), 3), time: '14:00' })
const end = ref({ date: shiftDate(todayCn(), 3), time: '17:00' })
const place = ref('')
const people = ref('20')
// 费用三选一（2026-11-03）：feeKind = free 免费 / paid 收费（fee 每人金额）/ aa AA制（aaFee 预估人均、aaNote 分摊什么，都选填）
const FEE_KINDS = [['free', '免费'], ['paid', '收费'], ['aa', 'AA制']]
const productKind = ref('activity')
const feeKind = ref('free')
const fee = ref('')
const aaFee = ref('')
const aaNote = ref('')
// 收费怎么付按活动来源定（服务端定，改的时候沿用原来的）：直营小院在线付，商家活动到场付给门店、平台不代收
const feeHint = computed(() => {
  if (feeKind.value === 'free') return '报名不用付钱'
  if (feeKind.value === 'aa') return '费用现场由参加的人平摊，报名时不用付钱，平台不收'
  const mode = editId.value && d.value.activityId === editId.value && Number(d.value.feeFen) > 0 ? d.value.feeMode : ''
  if (mode === 'online') return '报名时在线付款'
  if (mode || merchantStaff.value) return '报名的人到场付给门店，平台不代收'
  return '直营小院的活动报名时在线付款；商家活动到场付给门店'
})
// 活动介绍：新建、修改都随表单保存（服务端同样限 1000 字、过内容检查），也存进本机草稿
const INTRO_MAX = 1000
const INTRO_HINT = '写写活动流程、亮点、集合方式和注意事项。例如：14:00 在门店一楼集合，老师先示范再一起动手，做好的作品可以带走；请穿方便活动的衣服'
const intro = ref('')
const editingIntro = ref(false)
watch(s, (v) => { if (v !== 2) { editingIntro.value = false; typeSheet.value = false } })
const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
// 只改显示（11月4日 周三，跨年 2027年1月4日 周一），存的、提交的还是 yyyy-MM-dd
const dayLabel = (x) => {
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(x.date || ''))
  if (!ymd) return String(x.date || '')
  const year = ymd[1] === String(todayCn()).slice(0, 4) ? '' : ymd[1] + '年'
  return `${year}${Number(ymd[2])}月${Number(ymd[3])}日 ${WEEK[new Date(x.date + 'T00:00:00').getDay()] || ''}`
}
// 开始 / 结束时间的滚轮：今天起一年内的日期 | 时 | 分（5 分钟一格）。显示「11月4日 周三 14:00」
const when = computed(() => whenColumns(todayCn(), 366))
const whenLabel = (x) => `${dayLabel(x)} ${x.time || ''}`.trim()
// 结束时间自己选过（或改的是已有活动）就不跟着开始时间走，除非它不再晚于开始
let endTouched = false
const setWhen = (which, e) => {
  const w = whenPicked(e && e.detail && e.detail.value, when.value.dates)
  if (!w.date) return
  if (which === 'start') {
    start.value = w
    if (!endTouched || whenKey(end.value) <= whenKey(w)) end.value = addHours(w, 3)
    return
  }
  if (whenKey(w) <= whenKey(start.value)) return toast('结束时间要晚于开始时间')
  end.value = w
  endTouched = true
}
async function newActivity() {
  editId.value = null
  start.value = { date: shiftDate(todayCn(), 3), time: '14:00' }
  end.value = addHours(start.value, 3)
  endTouched = false
  type.value = '生活体验'
  title.value = ''
  cover.value = ''
  place.value = (currentStaffStore.value && currentStaffStore.value.storeName) || ''
  people.value = '20'
  productKind.value = 'activity'
  feeKind.value = 'free'
  fee.value = ''
  aaFee.value = ''
  aaNote.value = ''
  intro.value = ''
  meet.value = null
  hadMeet = false
  editingIntro.value = false
  tried.value = false
  s.value = 2
  await offerDraft(null)
}
// 活动地点 = 地图选点（2026-11-03 合成一行）：没填过直接打开地图；填过的先问是重新选点、只改名称文字，还是清掉地图位置
async function editPlaceText() {
  const v = await prompt('活动地点', { value: place.value, placeholder: '例如：门店一楼手作区' })
  if (v !== null) place.value = v.trim().slice(0, 100)
}
async function pickPlace() {
  let map = false
  // #ifndef H5
  map = true
  // #endif
  if (!map) return editPlaceText()
  if (place.value) {
    const i = await sheet(['在地图上重新选', '只改地点名称', ...(meet.value ? ['清除地图位置'] : [])])
    if (i === 1) return editPlaceText()
    if (i === 2) { meet.value = null; return toast('已清除地图位置，保存后生效') }
    if (i !== 0) return
  }
  return pickMeetPoint()
}
// 集合点地图位置（选填，V49 meetLat / meetLng）：小程序里用微信地图选点。hadMeet = 修改的这场原来标过点，
// 清除后保存要带上一对 null 服务端才会清；请求里不带这两个键 = 不改（「更换封面」那种整条保存就不带）
const meet = ref(null)
let hadMeet = false
const validPoint = (lat, lng) => {
  if (lat == null || lng == null || String(lat).trim() === '' || String(lng).trim() === '') return null
  const latitude = Number(lat), longitude = Number(lng)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || (latitude === 0 && longitude === 0)) return null
  return { latitude, longitude }
}
// 地图选点：地点名称 + 地址一起填进「活动地点」（「你带我的（平潭县xx路12号）」），坐标存成集合点。
// 地图打不开、没给位置权限时可以先直接写文字，地图位置以后再补
async function pickMeetPoint() {
  try {
    const r = await new Promise((resolve, reject) => uni.chooseLocation({ ...(meet.value || {}), success: resolve, fail: reject }))
    const p = validPoint(r.latitude, r.longitude)
    if (!p) return alert('没有选到有效位置', '请重新在地图上搜索、确认集合点。')
    meet.value = p
    const name = String(r.name || '').trim(), addr = String(r.address || '').trim()
    const text = name && addr && !addr.includes(name) ? `${name}（${addr}）` : (name || addr)
    if (text) place.value = text.slice(0, 100)
    toast('已选好地点，保存后生效')
  } catch (error) {
    const msg = String(error?.errMsg || '')
    if (/cancel/i.test(msg)) return
    const denied = /auth deny|auth denied|authorize|permission/i.test(msg)
    const r = await modal(denied ? '需要位置授权' : '地图暂时无法打开', denied ? '可以去设置里允许使用位置信息，也可以先直接写地点名称。' : '可以先直接写地点名称，报名的人会复制地点去搜索。',
      { confirmText: '直接写地点', cancelText: denied ? '去设置' : '取消' })
    if (r.confirm) return editPlaceText()
    if (denied && r.cancel) uni.openSetting({ fail: () => {} })
  }
}
async function pickCover() {
  const path = await chooseImage()
  if (!path) return
  try {
    cover.value = (await uploadTo('/app/upload/image', path)).data.url
  } catch (e) {
    fail(e, '图片上传失败')
  }
}
// 草稿只存本机一份，记着是「新建」还是「修改哪场活动」：点「创建活动」时恢复新建草稿，再次修改同一场活动时恢复那场的草稿。
// 原先只存不读（新建时表单直接清空），「保存草稿」等于没保存
const DRAFT = 'kangaroo:staff-activity-draft'
const readDraft = () => {
  try {
    const v = uni.getStorageSync(DRAFT)
    return v && typeof v === 'object' && v.start && v.end ? v : null
  } catch (e) {
    return null
  }
}
const dropDraft = () => { try { uni.removeStorageSync(DRAFT) } catch (e) { /* ignore */ } }
const draftName = (dr) => (dr.title ? `「${dr.title}」` : '（未填标题）')
async function offerDraft(forId) {
  const dr = readDraft()
  if (!dr || (dr.editId || null) !== (forId || null)) return
  const r = await modal('恢复草稿', `本机有一份${forId ? '这场活动的修改' : '未提交的'}草稿${draftName(dr)}${dr.savedAt ? '（保存于 ' + dr.savedAt + '）' : ''}。恢复后可继续编辑；丢弃会删除这份草稿。`,
    { confirmText: '恢复草稿', cancelText: '丢弃草稿' })
  if (r.cancel) { dropDraft(); toast('已丢弃草稿'); return }
  if (!r.confirm) return
  if (types.includes(dr.type)) type.value = dr.type
  title.value = String(dr.title || '')
  cover.value = dr.cover || ''
  start.value = { date: dr.start.date, time: dr.start.time }
  end.value = { date: dr.end.date, time: dr.end.time }
  place.value = dr.place || ''
  people.value = String(dr.people || '20')
  // 老草稿只有金额（0 = 免费）；新草稿记着选的哪一种
  productKind.value = dr.productKind === 'travel' ? 'travel' : 'activity'
  feeKind.value = ['free', 'paid', 'aa'].includes(dr.feeKind) ? dr.feeKind : (Number(dr.fee) > 0 ? 'paid' : 'free')
  fee.value = Number(dr.fee) > 0 ? String(dr.fee) : ''
  aaFee.value = String(dr.aaFee || '')
  aaNote.value = String(dr.aaNote || '')
  endTouched = true
  // 早先存的草稿没有介绍这一项：修改活动时保留从详情带出来的介绍，新建时为空
  if (dr.intro != null) intro.value = String(dr.intro)
  // 地图位置同理：老草稿没有这一项，保留详情带出来的点
  if (dr.meet !== undefined) meet.value = dr.meet ? validPoint(dr.meet.latitude, dr.meet.longitude) : null
  toast('已恢复草稿')
}
async function saveDraft() {
  const prev = readDraft()
  if (prev && (prev.editId || null) !== (editId.value || null)
    && !(await confirm('保存草稿', `本机只能存一份草稿，已有的草稿${draftName(prev)}会被覆盖。继续保存？`))) return
  const n = new Date()
  try {
    uni.setStorageSync(DRAFT, { editId: editId.value || null, savedAt: `${pad2(n.getMonth() + 1)}-${pad2(n.getDate())} ${pad2(n.getHours())}:${pad2(n.getMinutes())}`,
      type: type.value, title: title.value, cover: cover.value, start: { ...start.value }, end: { ...end.value }, place: place.value, people: people.value, fee: fee.value,
      productKind: productKind.value, feeKind: feeKind.value, aaFee: aaFee.value, aaNote: aaNote.value, intro: intro.value, meet: meet.value })
    toast(editId.value ? '草稿已存本机，再次修改本活动时可恢复' : '草稿已存本机，下次创建活动时可恢复')
  } catch (e) {
    toast('草稿保存失败')
  }
}
const dtText = (v) => (v ? String(v).replace('T', ' ').slice(0, 16) : '')
// 写请求进行中：网络慢时连点会重复创建活动、重复群发、重复审批退款
let busy = false
const once = async (fn) => {
  if (busy) return
  busy = true
  try { return await fn() } finally { busy = false }
}
// 就地提示：点过提交才标红（和招募表同一个做法）。规则和 submit 里的几条一样，没改
const tried = ref(false)
const formErrors = () => {
  const e = {}
  if (!title.value.trim()) e.title = '请填写活动标题'
  if (!place.value) e.place = '请填写活动地点'
  if (intro.value.trim().length > INTRO_MAX) e.intro = `活动介绍最多 ${INTRO_MAX} 字`
  const feeErr = feeError(feeKind.value, fee.value, aaFee.value)
  if (feeErr) e.fee = feeErr
  if (whenKey(end.value) <= whenKey(start.value)) e.time = '结束时间要晚于开始时间'
  return e
}
const aerr = computed(() => (tried.value ? formErrors() : {}))
// 2026-11-03 主人：简化提交。底部操作条上面一行不等点提交，一直写着还差哪几项（同 jobs.vue 的 todoText）；点了标红、滚到第一项。
// 都填好了写「可以提交」，点「提交发布」直接保存，不再弹「确认提交？」（原来也没有弹，这里只是把「还差什么」这一行补上）
const TODO_NAMES = { title: '活动标题', place: '活动地点', intro: '活动介绍（太长了）', fee: '费用', time: '结束时间' }
const TODO_FIELDS = { title: '#af-title', place: '#af-place', intro: '#af-intro', fee: '#af-fee', time: '#af-when' }
const todoKeys = computed(() => { const e = formErrors(); return Object.keys(TODO_NAMES).filter(k => e[k]) })
const todoText = computed(() => (todoKeys.value.length ? '还差：' + todoKeys.value.map(k => TODO_NAMES[k]).join('、') + '（点这里去填）' : '必填的都填好了，可以提交'))
function showTodo() {
  if (!todoKeys.value.length) return
  tried.value = true
  scrollToField(TODO_FIELDS[todoKeys.value[0]])
}
async function submit() {
  tried.value = true
  if (!title.value.trim()) { scrollToField('#af-title'); return toast('请填写活动标题') }
  if (!place.value) { scrollToField('#af-place'); return toast('请填写活动地点') }
  const introText = intro.value.trim()
  if (introText.length > INTRO_MAX) return toast(`活动介绍最多 ${INTRO_MAX} 字，现在 ${introText.length} 字，请删减后再提交`)
  const feeErr = feeError(feeKind.value, fee.value, aaFee.value)
  if (feeErr) { scrollToField('#af-fee'); return toast(feeErr) }
  if (whenKey(end.value) <= whenKey(start.value)) return toast('结束时间要晚于开始时间')
  // 费用：feeKind（免费 / 收费 / AA制）+ feeYuan；AA 再带预估人均、分摊说明（服务端：免费、AA 一律不建支付单）
  const payload = {
    productKind: productKind.value, category: type.value, title: title.value.trim(), cover: cover.value, place: place.value, capacity: Number(people.value),
    startTime: `${start.value.date} ${start.value.time}`, endTime: `${end.value.date} ${end.value.time}`,
    ...feeBody(feeKind.value, fee.value, aaFee.value, aaNote.value), intro: introText
  }
  // 地图位置：选了点就带上；修改时原来有点、现在清掉了，带一对 null；都没有就不带（服务端保持不变）
  if (meet.value || hadMeet) Object.assign(payload, { meetLat: meet.value ? meet.value.latitude : null, meetLng: meet.value ? meet.value.longitude : null })
  if (editId.value && d.value.activityId === editId.value) {
    // 表单里没有安全说明、报名截止：带上详情里的现值原样保存，不能因为表单没展示就把后台填的内容清空（介绍已在表单里，按表单保存）
    const a = d.value
    payload.safetyNote = a.safetyNote || ''
    payload.deadline = dtText(a.deadline)
    if (payload.deadline && payload.deadline >= payload.startTime) {
      // 开始时间提前到了原报名截止之前：原截止已经不成立，经员工确认后改成「开始前都可报名」
      if (!(await confirm('报名截止时间', `原报名截止时间 ${payload.deadline} 不早于新的开始时间，保存后改为「开始前都可报名」。继续保存？`))) return
      payload.deadline = ''
    }
  }
  await once(async () => {
    try {
      const res = editId.value ? await apiStaffEditActivity(editId.value, payload) : await apiStaffCreateActivity(currentStaffStoreId(), payload)
      const dr = readDraft()
      if (dr && (dr.editId || null) === (editId.value || null)) dropDraft()
      toast(res.data.message || '已保存')
      d.value = res.data
      s.value = 4
    } catch (e) {
      fail(e, '保存失败')
    }
  })
}

// ---------------- s=3 报名数据 ----------------
const stat = ref({ stats: [], channels: [], dates: [], views: [], signs: [] })
const RANGES = [['近7天', 6], ['近15天', 14], ['近30天', 29]]
const range = ref(1)
async function loadData() {
  if (!d.value.activityId) return
  try {
    stat.value = (await apiStaffActivityData(d.value.activityId, shiftDate(todayCn(), -RANGES[range.value][1]), todayCn())).data || stat.value
  } catch (e) {
    fail(e, '数据加载失败')
  }
}
async function pickActivity() {
  // 从消息直接进详情再进报名数据时列表还没取过，之前这里直接提示「本店还没有活动」
  if (!listLoaded.value) await loadList()
  const rows = data.value.rows || []
  if (!rows.length) return toast(listLoaded.value ? '本店还没有活动' : '活动列表加载失败，请稍后重试')
  const i = await pickPaged(rows.map(r => r.title), '选择活动')
  if (i >= 0) openDetail(rows[i].activityId, 3)
}
async function pickRange() {
  const i = await sheet(RANGES.map(r => r[0]))
  if (i >= 0) { range.value = i; loadData() }
}
const stats = computed(() => stat.value.stats || [])
// 「较昨日」按服务端给的变化值（+12% / -5% / +3 / 持平）定方向：涨绿色向上、跌红色向下，持平或没有对比值不画箭头。原先一律绿色向上
const deltaDir = (v) => {
  const t = String(v || '').trim()
  if (!t || t === '持平' || /^[+-]?0+(\.0+)?%?$/.test(t)) return 0
  return t.startsWith('-') ? -1 : (t.startsWith('+') ? 1 : 0)
}
const deltaStyle = (v) => (deltaDir(v) > 0 ? '' : { color: deltaDir(v) < 0 ? 'var(--k-alert)' : 'var(--k-muted)' })
// 渠道来源：时间段内没有浏览时图例只留一行「暂无浏览」，环形图画成灰环
const channels = computed(() => ((stat.value.channels || []).length ? stat.value.channels : [{ name: '暂无浏览', pct: '', num: '', color: '#DADADA' }]))
// 环形图按各渠道真实浏览量画（原先是样式里写死的一组比例，和右边的数字对不上）
const donutBg = computed(() => {
  const rows = (stat.value.channels || []).filter(c => Number(c.num) > 0)
  const total = rows.reduce((sum, c) => sum + Number(c.num), 0)
  if (!total) return '#DADADA'
  let acc = 0
  return `conic-gradient(${rows.map(c => {
    const from = acc
    acc += Number(c.num) * 100 / total
    return `${c.color} ${from.toFixed(1)}% ${acc.toFixed(1)}%`
  }).join(', ')})`
})
// 折线图宽度按屏宽算（和数据看板的 sparkW 一样）：画布 = 屏宽 − 页边距 32 − Y 轴 20 − 间距 8，再留 4px 给最右边的圆点。
// 之前写死 296，320 宽的手机上最后几个点伸出屏幕、整页能左右拖；390 宽时右边又空出一截。
// 高度和样式里 .data-body .chart__plot 的 90px 一致：之前按 112 算，0 值的点画在横轴下面 22px、压在日期上
let winW = 390
try { winW = uni.getSystemInfoSync().windowWidth || 390 } catch (e) { winW = 390 }
const W = Math.max(200, winW - 64), H = 90
const yMax = computed(() => {
  const m = Math.max(4, ...(stat.value.views || []), ...(stat.value.signs || []))
  return Math.ceil(m / 4) * 4
})
const yAxis = computed(() => [4, 3, 2, 1, 0].map(k => yMax.value * k / 4))
const toXY = (arr) => arr.map((v, i) => [arr.length > 1 ? i * (W / (arr.length - 1)) : 0, H - (v / yMax.value) * H])
const segsOf = (arr) => {
  const pts = toXY(arr); const out = []
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1]
    out.push({ left: x0 + 'px', top: y0 + 'px', width: Math.hypot(x1 - x0, y1 - y0) + 'px', transform: `rotate(${Math.atan2(y1 - y0, x1 - x0) * 180 / Math.PI}deg)` })
  }
  return out
}
const ptsOf = (arr) => toXY(arr).map(([x, y]) => ({ left: (x - 3) + 'px', top: (y - 3) + 'px' }))
const viewSegs = computed(() => segsOf(stat.value.views || []))
const signSegs = computed(() => segsOf(stat.value.signs || []))
const viewPts = computed(() => ptsOf(stat.value.views || []))
const signPts = computed(() => ptsOf(stat.value.signs || []))
const xDates = computed(() => {
  const ds = stat.value.dates || []
  if (ds.length <= 5) return ds
  return [0, 1, 2, 3, 4].map(k => ds[Math.round(k * (ds.length - 1) / 4)])
})
async function exportList() {
  try {
    const m = (await apiStaffActivity(d.value.activityId)).data
    const lines = ['昵称,状态,手机号（已打码）,签到']
    ;[...(m.confirmed || []), ...(m.waiting || [])].forEach(x => lines.push([x.name, x.tag, x.phone, x.checkedIn ? '是' : '否'].join(',')))
    copy(lines.join('\n'), `已复制 ${lines.length - 1} 人的名单，可粘贴到表格`)
  } catch (e) {
    fail(e, '导出失败')
  }
}

// ---------------- s=4 详情 ----------------
const d = ref({ confirmed: [], waiting: [], refunds: [] })
async function openDetail(id, screen) {
  try {
    d.value = (await apiStaffActivity(id)).data
    s.value = screen || 4
    if (s.value === 3) loadData()
  } catch (e) {
    fail(e, '活动不存在或没有权限')
  }
}
const reload = () => openDetail(d.value.activityId, s.value)
const dStats = computed(() => [
  { label: '报名', value: String(d.value.count || 0), sub: '/' + (d.value.capacity || 0) },
  { label: '已签到', value: String(d.value.checkedIn || 0) },
  { label: '候补', value: String(d.value.waitlist || 0) },
  { label: '评价', value: String(d.value.reviews || 0) }
])
const dTone = computed(() => ({ open: 'green', ongoing: 'ochre', pending: 'ochre', paused: 'ochre' }[d.value.phase] || 'gray'))
// 2026-11-03 主人：简化审核中的详情。待审核 / 被驳回只留 状态 + 驳回原因 + 修改活动 + 联系客服；审核通过（open / paused / 进行中 / 结束）才出 6 格和暂停 / 结束
const underReview = computed(() => d.value.status === 'pending' || d.value.status === 'rejected')
const reviewTip = computed(() => (d.value.status === 'rejected'
  ? (d.value.auditReason ? '改好后重新提交，会再次进入审核。' : '活动被驳回了，请点「修改活动」改好后再提交，会再次进入审核。')
  : (merchantStaff.value ? '活动正在审核中，通过后这里会出现成员、签到、通知等管理功能。' : '活动正在等平台审核，通过后这里会出现成员、签到、通知等管理功能。')))
// 联系客服：小程序按钮 open-type="contact" 直接拉起微信客服（session-from 格式同 fc-kefu），网页版去客服中心
// 2026-11-03 集成：网页版的人工客服入口和 components/fc-kefu.vue 一样直接写客服中心路径（「问问题」才用 k-ai-sheet 弹层；ai-sheet 测试守着页面不再经 routes 跳整页客服）
const kefuFrom = computed(() => fabSessionFrom(experience.account && experience.account.id))
const contactSupport = () => go('/pages/notice/support')
// 取消活动与服务端同一条规则：要有「活动管理·审核」权限；已有报名或收费的活动要有资金权限（归谁由服务端判，这里只读 canPay）。
// 详情接口按活动所属门店给了 canAudit，优先用它；没有时按当前门店的权限表
const canAuditAct = computed(() => (d.value.canAudit != null ? !!d.value.canAudit : staffCan('activities', 'audit')))
const canPayAct = computed(() => d.value.canPay != null ? !!d.value.canPay : staffCan('activities', 'pay'))
const canCancel = computed(() => canAuditAct.value && (canPayAct.value || (!(Number(d.value.feeFen) > 0) && !(Number(d.value.count) > 0))))
const cancelTip = computed(() => {
  if (canCancel.value) return '如遇突发情况，可快速发起通知或取消流程，保障成员安全。'
  return canAuditAct.value ? '如遇突发情况，可快速发起现场通知；取消已有报名或收费的活动需要活动支付权限。'
    : '如遇突发情况，可快速发起现场通知；取消活动需要活动审核权限。'
})
async function doAction(action, tip, needReason) {
  if (tip && !(await confirm('活动操作', tip))) return
  let reason
  if (needReason) {
    reason = await prompt('原因', { placeholder: '会通知所有报名的人' })
    if (reason === null) return
    if (!reason) return toast('请填写原因')
  }
  await once(async () => {
    try {
      toast((await apiStaffActivityAction(d.value.activityId, action, reason)).msg)
      reload()
    } catch (e) {
      fail(e, '操作失败')
    }
  })
}
async function broadcast(preset) {
  const text = await prompt('现场通知', { value: preset || '', placeholder: '会发到活动群并逐个通知已确认成员' })
  if (!text) return
  await once(async () => {
    try {
      toast((await apiStaffActivityBroadcast(d.value.activityId, text)).msg)
    } catch (e) {
      fail(e, '发送失败')
    }
  })
}
// 2026-11-03 主人：「活动群聊」「成员管理」合到一起 —— 单独一页，最上面大按钮进活动群，下面是成员名单（私信 / 电话）和退款审批
const openMembers = () => go('/pages/staff/activity-members?id=' + d.value.activityId)
async function checkinMenu() {
  const i = await sheet(['输入参与者的签到码', '出示签到二维码'])
  if (i === 0) {
    const code = await prompt('签到', { placeholder: '参与者出示的 6 位签到码' })
    if (!code) return
    await once(async () => {
      try {
        toast((await apiStaffActivityCheckin(d.value.activityId, code)).msg)
        reload()
      } catch (e) {
        fail(e, '签到失败')
      }
    })
  }
  // 2026-11-03 主人：「出示二维码失效，生成失败」。改成单独一页：微信小程序码按当前版本生成，生成不出来就给普通二维码 + 6 位活动签到码，现场不会卡住
  if (i === 1) go('/pages/community/activity-checkin?mode=staff&id=' + d.value.activityId + '&title=' + encodeURIComponent(d.value.title || ''))
}
async function editActivity() {
  const a = d.value
  editId.value = a.activityId
  type.value = a.category || '其他'
  title.value = a.title
  cover.value = a.img || ''
  const st = String(a.startTime || '').replace('T', ' ')
  const et = String(a.endTime || a.startTime || '').replace('T', ' ')
  start.value = { date: st.slice(0, 10), time: st.slice(11, 16) }
  end.value = { date: et.slice(0, 10), time: et.slice(11, 16) }
  place.value = a.place || ''
  meet.value = validPoint(a.meetLat, a.meetLng)
  hadMeet = !!meet.value
  people.value = String(a.capacity || 20)
  productKind.value = a.productKind === 'travel' ? 'travel' : 'activity'
  feeKind.value = feeKindOf(a)
  fee.value = yuanText(a.feeFen)
  aaFee.value = yuanText(a.aaFen)
  aaNote.value = feeKind.value === 'aa' ? (a.feeIncludes || '') : ''
  endTouched = true
  intro.value = a.intro || ''
  editingIntro.value = false
  tried.value = false
  s.value = 2
  await offerDraft(a.activityId)
}
// 2026-11-03 主人：合并成 6 格。「修改活动」打开整张修改表（封面也在里面换），原来「相册管理」只能换封面、没有别的相册功能，所以没丢东西
const actions = computed(() => [
  { icon: 'users-round', title: groupChatEnabled.value ? '成员与群聊' : '成员管理', sub: groupChatEnabled.value ? (canPayAct.value ? '名单、进群、退款' : '名单、进群') : (canPayAct.value ? '名单、退款' : '成员名单'), run: openMembers },
  { icon: 'scan-qr-code', title: '签到管理', sub: '签到码 / 二维码', run: checkinMenu },
  { icon: 'volume-2', title: '现场通知', sub: '发送通知', run: () => broadcast() },
  { icon: 'square-pen', title: '修改活动', sub: '封面、时间、介绍', run: editActivity },
  { icon: 'message-square-text', title: '评价收集', sub: '回收评价', run: () => go(R.staffReviews) },
  { icon: 'chart-pie', title: '数据看板', sub: '活动数据', run: () => { s.value = 3; loadData() } }
])
const onAction = (g) => g.run()
async function weatherFlow() {
  // 「取消活动」与详情底部的取消入口同一条权限规则，没权限的角色不出现这一项
  const i = await sheet(['通知成员：活动改期', '通知成员：注意防雨 / 防晒', ...(canCancel.value ? ['取消活动（全员通知）'] : [])])
  if (i === 0) broadcast('因天气原因，活动改期，新时间稍后在群里通知，请留意。')
  if (i === 1) broadcast('出发前请查看天气预报，注意防雨 / 防晒，穿防滑鞋。')
  if (i === 2) doAction('cancel', '取消后会通知所有报名的人，在线支付的报名费转为退款待审批。确认取消？', true)
}
const pauseLabel = computed(() => (d.value.status === 'paused' || d.value.status === 'closed' ? '恢复报名' : '暂停报名'))
const togglePause = () => (d.value.status === 'paused' || d.value.status === 'closed'
  ? doAction('resume', '恢复接受报名？') : doAction('pause', '暂停后可随时恢复。确认暂停报名？'))
const endActivity = () => doAction('end', '确认活动已结束？结束后不能恢复。')
const cancelActivity = () => doAction('cancel', '取消后会通知所有报名的人，在线支付的报名费转为退款待审批。确认取消？', true)
// 之前除列表外一律回列表：从详情「修改活动」「数据看板」进去的修改页 / 报名数据，返回丢了刚才的详情。
// 现在这两屏回详情；直接打开的那一屏（landing）回来源页
const onBack = () => {
  if (typeSheet.value) { typeSheet.value = false; return }
  if (s.value === 1 || s.value === landing) return back()
  if (d.value.activityId && (s.value === 3 || (s.value === 2 && editId.value === d.value.activityId))) s.value = 4
  else s.value = 1
}
</script>

<style scoped lang="scss">
/* 创建活动（s=2）的样式在 ./form-clean.scss，和招募、新增房源、线上任务发布共用 */
@import './form-clean.scss';
.pad-both { padding-bottom: calc(150px + var(--k-safe-bottom)); }
.act-bar { position: fixed; left: 0; right: 0; bottom: calc(56px + var(--k-safe-bottom)); z-index: 49; padding: 10px 16px 12px; background: var(--k-bg); display: flex; gap: 12px; }

.sec { display: block; font-family: var(--k-serif); font-weight: 700; font-size: 16px; }
.k-mt6 { margin-top: 6px; } .k-mt10 { margin-top: 10px; } .k-mt14 { margin-top: 14px; }
.k-gap2 { gap: 2px; } .k-gap5 { gap: 5px; } .k-gap14 { gap: 14px; }
.k-baseline { align-items: baseline; }

/* s1 */
.search-row { display: flex; align-items: center; gap: 10px; padding-bottom: 6px; }
.search { flex: 1; display: flex; align-items: center; gap: 8px; height: 36px; padding: 0 14px; border: 1px solid var(--k-line2); border-radius: 999px; background: var(--k-paper); }
.search input { flex: 1; min-width: 0; font-size: 13px; height: 34px; }
.tabs { display: flex; align-items: center; padding: 0 16px; border-bottom: 1px solid var(--k-line); }
.tabs__item { position: relative; flex: 1; text-align: center; padding: 10px 0; font-size: 14px; color: var(--k-ink); }
.tabs__item.active { color: var(--k-red); font-weight: 600; }
.tabs__item.active::after { content: ""; position: absolute; left: 50%; bottom: 0; width: 46px; height: 2px; margin-left: -23px; background: var(--k-red); border-radius: 2px; }
.pills { display: flex; gap: 10px; padding: 12px 16px; border-bottom: 1px solid var(--k-line); }
.pill { display: flex; align-items: center; gap: 4px; height: 30px; padding: 0 12px; border: 1px solid var(--k-line2); border-radius: 999px; background: var(--k-paper); font-size: 13px; }
.list { padding: 0 16px; }
.item { display: flex; gap: 12px; padding: 14px 0 12px; border-bottom: 1px solid var(--k-line); }
.item__img { width: 56px; height: 82px; border-radius: 8px; flex: 0 0 auto; }
.tag { display: inline-flex; align-items: center; height: 18px; padding: 0 6px; border-radius: 4px; color: #fff; font-size: 11px; font-weight: 600; flex: 0 0 auto; }
.tag--green { background: var(--k-green); }
.tag--ochre { background: #B8792A; }
.tag--gray { background: #8C8378; }
.item__title { font-family: var(--k-serif); font-weight: 700; font-size: 16px; flex: 1; min-width: 0; }
.item__meta { display: flex; align-items: center; gap: 10px; margin-top: 5px; font-size: 12px; color: var(--k-muted); letter-spacing: .5px; }
.vline { width: 1px; height: 12px; background: var(--k-line2); }
.item__line { display: flex; align-items: center; gap: 6px; margin-top: 5px; font-size: 13px; color: var(--k-ink); }
.item__price { margin-left: 16px; }
.item__src { flex-shrink: 0; }
.item__owner, .item__place { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.item__place { flex: 1; margin-right: 8px; }
.audit { flex-shrink: 0; height: 20px; padding: 0 8px; display: flex; align-items: center; border-radius: 4px; font-size: 11px; border: 1px solid; }
.audit--green { color: var(--k-green); border-color: #B9CFC0; background: var(--k-paper); }
.audit--ochre { color: var(--k-ochre-deep); border-color: #E3CFA6; background: var(--k-paper); }
.audit--gray { color: var(--k-muted); border-color: var(--k-line2); background: var(--k-paper); }

/* s2 */
.fc-count.k-alert { color: var(--k-alert); }
/* 2026-11-03 简化：底部「还差什么」一行（同 jobs.vue）；这一行可能折两行，表单底部多留 20 */
.fc-bar__todo { display: flex; align-items: center; justify-content: center; min-height: 44px; margin-top: -8px; padding: 0 4px; font-size: 14px; line-height: 20px; text-align: center; color: var(--k-red-deep); }
.fc-bar__todo--err { color: var(--k-alert); }
.fc-bar__todo--ok { color: var(--k-muted); }
.fc-form { padding-bottom: calc(128px + var(--k-safe-bottom)); }

/* s3 */
.select { display: flex; align-items: center; gap: 8px; height: 30px; padding: 0 12px; border: 1px solid var(--k-line2); border-radius: 8px; background: var(--k-paper); font-size: 13px; }
.select--date { flex: 0 0 auto; }
.select--act { flex: 1; min-width: 0; }
.stats { display: flex; gap: 10px; }
.stat { flex: 1; min-width: 0; padding: 12px 10px 10px; border: 1px solid var(--k-line); border-radius: 10px; background: var(--k-paper); display: flex; flex-direction: column; gap: 6px; }
.stat__label { font-size: 13px; font-weight: 500; }
.stat__num { font-family: var(--k-serif); font-weight: 700; font-size: 22px; line-height: 1.1; }
.stat__delta { font-size: 12px; color: var(--k-green); }
.donut { width: 90px; height: 90px; border-radius: 50%; flex: 0 0 auto; background: conic-gradient(#4E8FC4 0 42%, #73B3DA 42% 67%, #9ED0E4 67% 85%, #B9B9B9 85% 95%, #DADADA 95% 100%); display: flex; align-items: center; justify-content: center; }
.donut__hole { width: 54px; height: 54px; border-radius: 50%; background: var(--k-bg); }
.legend { padding-left: 8px; display: flex; flex-direction: column; gap: 3px; }
.legend__row { display: flex; align-items: center; gap: 8px; font-size: 13px; height: 18px; }
.legend__dot { width: 7px; height: 7px; border-radius: 50%; flex: 0 0 auto; }
.legend__name { width: 76px; }
.legend__pct { width: 40px; text-align: center; }
.legend__num { flex: 1; text-align: right; }
.chart { display: flex; gap: 8px; margin-top: 12px; height: 112px; }
.chart__y { width: 20px; display: flex; flex-direction: column; justify-content: space-between; text-align: right; font-size: 12px; color: var(--k-muted); line-height: 1; margin-top: -6px; margin-bottom: -6px; }
.chart__plot { position: relative; flex: 1; min-width: 0; height: 112px; }
.chart__grid { position: absolute; left: 0; right: 0; height: 0; border-top: 1px dashed var(--k-line2); }
.chart__axis { position: absolute; left: 0; top: 0; bottom: 0; width: 1px; background: var(--k-line2); }
.seg { position: absolute; height: 2px; transform-origin: 0 50%; border-radius: 1px; }
.seg--blue { background: #4E8FC4; }
.seg--green { background: var(--k-green); }
.pt { position: absolute; width: 6px; height: 6px; border-radius: 50%; background: var(--k-bg); border: 1.5px solid; }
.pt--blue { border-color: #4E8FC4; }
.pt--green { border-color: var(--k-green); }
.chart__x { display: flex; justify-content: space-between; padding-left: 20px; margin-top: 8px; font-size: 12px; color: var(--k-muted); }
.sums { align-items: stretch; }
.sum { flex: 1; min-width: 0; border: 1px solid var(--k-line); border-radius: 10px; background: var(--k-paper); display: flex; }
.sum--pair { flex: 2; }
.sum__cell { flex: 1; min-width: 0; padding: 14px 16px; display: flex; flex-direction: column; }
.sum__cell--line { border-left: 1px solid var(--k-line); }
.sum__label { font-family: var(--k-serif); font-weight: 700; font-size: 14px; margin-bottom: 6px; }
.sum__num { font-family: var(--k-serif); font-weight: 700; font-size: 24px; line-height: 1; }
.btn-export { flex: 0 0 auto; }

/* s4 */
.d-cover { width: 92px; height: 108px; border-radius: 8px; flex: 0 0 auto; }
.d-title { display: block; font-family: var(--k-serif); font-weight: 700; font-size: 18px; margin-top: 8px; }
.d-line { display: flex; align-items: center; gap: 6px; margin-top: 7px; font-size: 14px; }
.d-stats { display: flex; border: 1px solid var(--k-line); border-radius: 10px; background: var(--k-paper); }
.d-stat { flex: 1; min-width: 0; height: 52px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; }
.d-stat.line { border-left: 1px solid var(--k-line); }
.d-stat__label { font-size: 13px; color: var(--k-muted); }
.d-stat__num { font-family: var(--k-serif); font-weight: 700; font-size: 20px; line-height: 1.1; }
.d-stat__sub { font-size: 12px; color: var(--k-muted); margin-left: 1px; }
.grid { display: grid; grid-template-columns: repeat(3, 1fr); border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-paper); overflow: hidden; }
.grid__cell { height: 112px; padding: 0 4px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; text-align: center; }
.grid__cell--r { border-right: 1px solid var(--k-line); }
.grid__cell--b { border-bottom: 1px solid var(--k-line); }
.grid__title { font-family: var(--k-serif); font-weight: 700; font-size: 17px; margin-top: 6px; }
.grid__sub { font-size: 13px; color: var(--k-muted); }
.weather { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border: 1px solid var(--k-line); border-radius: 10px; background: var(--k-paper); }
.weather__text { font-size: 14px; line-height: 1.6; white-space: pre-line; }
.weather__btn { height: 30px; padding: 0 8px; display: flex; align-items: center; border: 1px solid var(--k-ochre); border-radius: 6px; color: var(--k-ochre-deep); font-size: 12px; flex: 0 0 auto; }
.tips { padding: 14px; border-radius: 10px; background: var(--k-paper2); }
.tips__title { display: block; font-family: var(--k-serif); font-weight: 700; font-size: 14px; }
.tips__text { display: block; margin-top: 8px; font-size: 13px; color: var(--k-muted); line-height: 1.6; }
.tips__link { font-family: var(--k-serif); font-weight: 700; font-size: 14px; color: var(--k-red); }
.btn-pause { width: 134px; }
/* 2026-11-03 简化：审核中的详情只有「修改活动」「联系客服」两个大按钮（52 高，老年用户点得准）；小程序 button 要去掉自带的边和内距 */
.rv-btns { display: flex; gap: 12px; }
.rv-btn { flex: 1; min-width: 0; height: 52px; margin: 0; padding: 0; border-radius: 12px; background: var(--k-red-deep); color: var(--k-paper); display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 17px; font-weight: 600; line-height: 1; }
.rv-btn::after { border: 0; }
.rv-btn--ghost { background: var(--k-paper2); color: var(--k-ink); }
.data-body .stat{padding:8px}.data-body .donut{width:78px;height:78px}.data-body .donut__hole{width:47px;height:47px}.data-body .chart{height:90px;margin-top:8px}.data-body .chart__plot{height:90px}.data-body .chart__x{margin-top:5px}.data-body .k-mt16{margin-top:9px}.data-body .sum__cell{padding:9px 12px}.data-body .act-bar{padding-top:8px;padding-bottom:8px}
</style>
