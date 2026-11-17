<template>
  <!-- #ifdef MP-WEIXIN -->
  <page-meta :page-style="s === 1 && sheetKey ? 'overflow: hidden' : ''" />
  <!-- page-meta 必须是页面第一个节点。发布屏的底部弹层开着时锁住页面滚动（弹框里的 scroll-view 不能用 catchtouchmove 拦，拦了它自己也滑不动）。
       2026-11-03 主人：简化 —— 预计完成时间改成系统滚轮（picker），不再有日历弹层要锁。
       只在小程序里加：H5 的 page-meta 关弹窗时清不掉这条样式（H5 用 lockPageScroll 锁 body） -->
  <!-- #endif -->
  <k-feature-gate feature="recruitment" :bypass="s !== 1">
  <view class="k-page online">
    <k-topbar :title="titles[s - 1]" back custom-back :fab="s !== 1" @back="onBack" />
    <!-- 线上任务接待设置（换工主理人、小院主理人才看得到）：发布屏排在表单最后，不占第一屏；别的屏还在最上面 -->
    <k-chat-reception v-if="s !== 1" :store-id="taskStore || sid()" />

    <view v-if="s === 1" class="fc-form publish-page">
      <view v-if="merchantStaff" class="fc-block">
        <text class="fc-group__title">发布费用</text>
        <text v-if="resubmit" class="fc-note">修改已有任务沿用提交时确认的费用。</text>
        <text v-else-if="publicationFee" class="fc-note">{{publicationFee.enabled==='1'?'本次发布 ¥'+(publicationFee.amountFen/100).toFixed(2)+'，审核上架后计费。':'当前免费发布。'}} 同一任务修改或恢复上架只计费一次。</text>
        <view v-if="publicationFeeError" class="fc-note" hover-class="k-press" @click="loadPublicationFee">{{publicationFeeError}} · 点击重试</view>
        <view class="fc-row" hover-class="k-press" @click="go('/pages/staff/publication-fees?storeId='+sid())"><text>查看发布费用记录</text><k-icon name="chevron-right" :size="16" color="muted"/></view>
      </view>
      <!-- 发布线上任务（2026-10-31 R7 改版，主人：看起来很乱，用的人有年龄大的，要干净成熟）：一组一块通栏白底，样式 form-clean.scss，字段一个没少。
           要填的 = 用户端任务详情展示的东西（任务报酬、交付时间、预计耗时、具体工作内容、我们希望你）+ 验收要用的交付物和验收标准。素材接单后在交付记录里发，这里不传。
           流程怎么走一直写在表单最后一行（flowNote，2026-11-03 起提交不再弹确认框） -->
      <text v-if="resubmit && resubmit.reason" class="fc-notice fc-notice--alert">退回原因：{{ resubmit.reason }}</text>
      <view class="fc-block">
        <text class="fc-group__title">任务信息</text>
        <view id="of-title" class="fc-field">
          <view class="fc-label"><text class="fc-label__t">任务标题</text><text class="fc-req">必填</text><text class="fc-count">{{ form.title.length }}/30</text></view>
          <input class="fc-input" :class="{ 'fc-input--err': ferr.title }" :value="form.title" maxlength="30" placeholder="例如：给海边小院写小红书探店笔记" placeholder-class="fc-ph" @input="form.title = $event.detail.value" />
          <text v-if="ferr.title" class="fc-err">{{ ferr.title }}</text>
        </view>
        <view class="fc-row" hover-class="k-press" @click="openSheet('taskType')"><text class="fc-row__k">任务类型</text><text class="fc-row__v">{{ form.taskType }}</text><k-icon name="chevron-right" :size="18" color="muted" /></view>
      </view>
      <view class="fc-block">
        <text class="fc-group__title">交付与截止</text>
        <view id="of-deliverables" class="fc-field">
          <view class="fc-label"><text class="fc-label__t">交付物</text><text class="fc-req">必填</text><text class="fc-count">{{ form.deliverables.length }}/100</text></view>
          <textarea v-if="editingText === 'deliverables'" class="fc-area fc-area--short" :value="form.deliverables" maxlength="100" placeholder="例如：小红书图文 1 篇（含封面），原图打包" placeholder-class="fc-ph" :focus="true" auto-focus :show-confirm-bar="false" @input="form.deliverables = $event.detail.value" @blur="endText('deliverables', $event)" />
          <view v-else class="fc-area fc-area--short fc-area--idle" :class="{ 'fc-area--err': ferr.deliverables }" hover-class="k-press" @click="editingText = 'deliverables'"><text :class="{ 'fc-ph': !form.deliverables }">{{ form.deliverables || '例如：小红书图文 1 篇（含封面），原图打包' }}</text></view>
          <text v-if="ferr.deliverables" class="fc-err">{{ ferr.deliverables }}</text>
        </view>
        <!-- 2026-11-03 主人：简化 —— 默认就填好「7 天后 18:00」，点了用一个「日期 | 时 | 分」滚轮改（和创建活动同一个滚轮）；之前是 日历 → 时刻菜单 → 手敲时刻 三步 -->
        <view class="fc-field deadline-field"><text class="fc-row__k">预计完成时间</text><text class="fc-note">北京时间，至少晚于现在2小时</text><view class="deadline-inputs"><button class="deadline-date" @click="editingText='';deadlineCalendar=true">{{deadlineWhen.date}}<k-icon name="calendar-days" :size="18" color="red"/></button><picker mode="time" :value="deadlineWhen.time" @change="form.deadline=deadlineWhen.date+' '+$event.detail.value"><view class="deadline-clock">{{deadlineWhen.time}}<k-icon name="clock" :size="18" color="red"/></view></picker></view></view>
        <k-date-picker v-if="deadlineCalendar" title="选择完成日期" :value="deadlineWhen.date" :min-date="todayCn()" @cancel="deadlineCalendar=false" @confirm="form.deadline=$event+' '+deadlineWhen.time;deadlineCalendar=false"/>
      </view>
      <view class="fc-block">
        <text class="fc-group__title">报酬与名额</text>
        <view v-if="perItemForm" id="of-commission" class="fc-field">
          <view class="fc-label"><text class="fc-label__t">接单人报酬</text><text class="fc-req">由商家填写</text></view>
          <input class="fc-input" type="digit" v-model="unitRewardText" maxlength="7" placeholder="每条合格成果报酬（元）" aria-label="每条接单人报酬"/>
          <text class="fc-note">接单人报酬按上方单价 × 合格条数结算。每人最高报酬不超过5000元。</text>
          <text class="fc-note">平台服务费：商家另付 ¥3 / 合格条，验收后按合格条数计算，不从接单人报酬中扣除。</text>
          <view class="fc-label"><text class="fc-label__t">每人交付条数上限</text><text class="fc-req">1–100 条</text></view>
          <input class="fc-input" type="number" :value="form.itemsPerPerson" maxlength="3" placeholder="填写每人最多交付条数" @input="form.itemsPerPerson=$event.detail.value" />
          <text v-if="ferr.commission" class="fc-err">{{ ferr.commission }}</text>
          <text v-else class="fc-note">每人最高 ¥{{ (Number(form.itemsPerPerson)*(Number(unitRewardText)||0)).toFixed(2) }}，未合格部分不计报酬。</text>
        </view>
        <view v-else id="of-commission" class="fc-field">
          <view class="fc-label"><text class="fc-label__t">单人佣金</text><text class="fc-req">必填</text></view>
          <view class="fc-money" :class="{ 'fc-money--err': ferr.commission }"><text class="fc-money__sign">¥</text><input class="fc-money__input" type="digit" :value="commissionText" maxlength="7" placeholder="1–5000" placeholder-class="fc-ph" @input="setCommission($event.detail.value)" /><text class="fc-money__unit">元 / 人</text></view>
          <text v-if="ferr.commission" class="fc-err">{{ ferr.commission }}</text>
          <text v-else class="fc-note">验收通过后由门店线下结算给接单人</text>
        </view>
        <view class="fc-row"><text class="fc-row__k">名额</text><view class="fc-stepper"><view class="fc-stepper__btn" hover-class="k-press" @click="stepQuota(-1)"><k-icon name="minus" :size="20" :color="form.quota <= 1 ? 'light' : 'ink'" /></view><input class="fc-stepper__num fc-quota-input" type="number" v-model="form.quota" maxlength="2" aria-label="任务名额" placeholder="1–50"/><text>人</text><view class="fc-stepper__btn" hover-class="k-press" @click="stepQuota(1)"><k-icon name="plus" :size="20" :color="form.quota >= 50 ? 'light' : 'ink'" /></view></view></view>
      </view>
      <view class="fc-block">
        <text class="fc-group__title">验收</text>
        <view id="of-criteria" class="fc-field">
          <view class="fc-label"><text class="fc-label__t">验收标准</text><text class="fc-req">必填</text><text class="fc-count">{{ form.criteria.length }}/200</text></view>
          <textarea v-if="editingText === 'criteria'" class="fc-area fc-area--short" :value="form.criteria" maxlength="200" placeholder="例如：原创、800 字以上、图片清晰不带水印" placeholder-class="fc-ph" :focus="true" auto-focus :show-confirm-bar="false" @input="form.criteria = $event.detail.value" @blur="endText('criteria', $event)" />
          <view v-else class="fc-area fc-area--short fc-area--idle" :class="{ 'fc-area--err': ferr.criteria }" hover-class="k-press" @click="editingText = 'criteria'"><text :class="{ 'fc-ph': !form.criteria }">{{ form.criteria || '例如：原创、800 字以上、图片清晰不带水印' }}</text></view>
          <text v-if="ferr.criteria" class="fc-err">{{ ferr.criteria }}</text>
        </view>
      </view>
          <view class="fc-block account-requirements">
            <view class="fc-label"><text class="fc-label__t">账号与参与要求</text></view>
            <textarea v-if="editingText === 'requirements'" class="fc-area fc-area--short" :value="requirementsText" maxlength="130" placeholder="一行写一条，例如：有小红书账号，粉丝 500 以上" placeholder-class="fc-ph" :focus="true" auto-focus :show-confirm-bar="false" @input="requirementsDraft = $event.detail.value" @blur="endText('requirements', $event)" />
            <view v-else class="fc-area fc-area--short fc-area--idle" hover-class="k-press" @click="editingText = 'requirements'"><text :class="{ 'fc-ph': !requirementsText }">{{ requirementsText || '一行写一条，例如：有小红书账号，粉丝 500 以上' }}</text></view>
            <view class="fc-foot"><text class="fc-note">最多 3 条，每条 40 字以内</text><text class="fc-count">{{ form.requirements.length }}/3 条</text></view>
          </view>
      <!-- 更多选填：新发布默认收起；改被退回的任务时里面已有内容就默认展开。四个必填都不在这里，报错不用自动展开 -->
      <view class="fc-block">
        <view class="fc-more" :class="{ 'fc-more--open': moreOpen }" hover-class="k-press" @click="moreOpen = !moreOpen">
          <view class="fc-more__copy"><text class="fc-more__t">更多选填<text class="fc-more__n">（2 项{{ moreFilled ? '，已填 ' + moreFilled + ' 项' : '' }}）</text></text><text v-if="!moreOpen" class="fc-more__sum">预计耗时、任务描述</text></view>
          <view class="fc-more__act"><text>{{ moreOpen ? '收起' : '展开' }}</text><k-icon :name="moreOpen ? 'chevron-up' : 'chevron-down'" :size="18" color="#8A5E36" /></view>
        </view>
        <view v-if="moreOpen">
          <view class="fc-row" hover-class="k-press" @click="openSheet('estHours')"><text class="fc-row__k">预计耗时</text><text class="fc-row__v" :class="{ 'fc-row__v--empty': !form.estHours }">{{ form.estHours || '请选择' }}</text><k-icon name="chevron-right" :size="18" color="muted" /></view>

          <view class="fc-field">
            <view class="fc-label"><text class="fc-label__t">任务描述</text><view class="fc-act" hover-class="k-press" @click="generate"><text>按模板生成（非 AI）</text></view></view>
            <textarea v-if="editingText === 'description'" class="fc-area" :value="form.description" maxlength="300" placeholder="不写就用交付物；点「按模板生成」起个草稿再改" placeholder-class="fc-ph" :focus="true" auto-focus :show-confirm-bar="false" @input="form.description = $event.detail.value" @blur="endText('description', $event)" />
            <view v-else class="fc-area fc-area--idle" hover-class="k-press" @click="editingText = 'description'"><text :class="{ 'fc-ph': !form.description }">{{ form.description || '不写就用交付物；点「按模板生成」起个草稿再改' }}</text></view>
            <view class="fc-foot fc-foot--end"><text class="fc-count">{{ form.description.length }}/300</text></view>
          </view>
        </view>
      </view>
      <!-- 2026-11-03 主人：简化 —— 提交前不再弹「确认提交？」，原来确认框里说的流程（佣金怎么结、谁审核上架）改成一直写在这里 -->
      <text v-if="merchantStaff && !perItemForm" class="fc-note">历史任务保留原约定佣金，不改为新任务的按条计价。</text>
      <merchant-agreement v-if="merchantStaff && perItemForm" ref="agreementRef" type="online_task" :store-id="resubmit ? resubmit.storeId : sid()" />
      <text class="fc-footnote">{{ flowNote }}</text>
      <text class="fc-footnote">拍摄要点、参考图、文件等素材，接单后在「交付记录」里发给接单人（文字、图片、文件都行），这里不用传。</text>
      <k-chat-reception :store-id="taskStore || sid()" />
    </view>

    <view v-else-if="s === 2" class="k-body k-pad-tab" :class="task ? 'detail-page' : 'list-page'">
      <!-- 2026-11-03 主人：简化 —— 第 2 屏先是任务列表（每张卡写报名 / 待验收），点一张进任务详情，详情里接单人一人一行、点行进交付页。
           之前：详情顶上「点标题弹任务列表」、底下「查看交付弹接单人列表」两个弹窗，现在都没了。从工作台带 jobId 进来直接落到那条任务 -->
      <template v-if="!task">
      <text class="list-hint">点一条任务，审核报名、查看接单人和交付进度</text>
      <view v-if="tasksLoading && !tasks.length" class="list-state"><text>正在读取线上任务…</text></view>
      <view v-else-if="!tasks.length" class="list-state"><text>还没有线上任务</text><k-button size="md" label="去发布线上任务" @click="s = 1" /></view>
      <view v-for="(tk, ti) in tasks" :key="tk.jobId" class="task-card" hover-class="k-press" @click="openTaskCard(ti)">
        <view class="task-card__head"><text class="task-card__title">{{ tk.title }}</text><k-chip tone="ochre"><text>{{ tk.statusLabel || '—' }}</text></k-chip></view>
        <view class="task-card__foot"><button v-if="tk.canAuditApplications" class="application-count" hover-class="k-press-s" @click.stop="openTaskApplications(tk)">报名 {{ tk.applied || 0 }} 人 · 审核</button><text v-else>报名 {{ tk.applied || 0 }} 人</text><text :class="Number(tk.waiting) ? 'k-alert' : 'k-meta'">待验收 {{ tk.waiting || 0 }}</text><view class="k-flex1" /><text class="k-meta">看接单人</text><k-icon name="chevron-right" :size="18" color="muted" /></view>
        <view v-if="tk.canAuditApplications" class="task-audit" hover-class="k-press-s" @click.stop="openTaskApplications(tk)"><k-button type="outline" size="md" :label="'审核报名（待审核 ' + (tk.pendingApplications || 0) + '）'" /></view>
      </view>
      </template>
      <template v-else>
      <view class="all-tasks" hover-class="k-press" @click="showTaskList"><k-icon name="chevron-left" :size="18" color="ink" /><text>全部任务</text></view>
      <view class="hero"><image src="/static/media/online-hero.jpg" mode="aspectFill" /><view class="hero__title"><text class="field-text">{{ T.title || '—' }}</text><k-chip tone="ochre"><text>{{ T.chip || '—' }}</text></k-chip></view></view>
      <view class="detail-card"><text class="section-title">任务说明</text><text class="detail-card__desc">{{ T.content || '—' }}</text><view class="detail-stats"><view><text>预计工时</text><text>{{ T.estHours || '—' }}</text></view><view><text>{{ T.rewardMode==='per_item' ? '单人最高报酬' : '佣金（元）' }}</text><text class="k-red">{{ T.commission || '—' }}</text></view><view><text>预计完成</text><text>{{ T.deadline || '—' }}</text></view></view></view>
      <!-- 2026-11-03 主人「线上任务几天是预期，过期了线上专员有个继续开启」：到期自动停止接单的，改一个新的预计完成时间就重新接单（合作商家、换工主理人不给）。
           2026-11-03 主人：简化 —— 新时间不用手敲「2026-11-10 18:00」，用同一个「日期 | 时 | 分」滚轮，默认值用服务端给的（没有就 7 天后 18:00） -->
      <view v-if="T.reopenable" class="reopen-card"><text>已过预计完成时间，任务已停止接单。{{ T.canReopen ? '选一个新的预计完成时间，点「继续开启」就能重新接单。' : (merchantStaff ? '需要袋鼠工作人员继续开启。' : '需要线上任务专员、小院主理人或平台继续开启。') }}</text>
        <view v-if="T.canReopen" class="reopen-when"><text class="reopen-when__k">新的预计完成时间</text><picker mode="multiSelector" :range="when.cols" :value="whenIndex(reopenPicked, when.dates)" @change="setReopen($event)"><view class="fc-pick" hover-class="k-press-s"><text class="fc-pick__t">{{ reopenLabel }}</text></view></picker></view>
        <k-button v-if="T.canReopen" size="md" :disabled="reopening" :label="reopening ? '处理中…' : '继续开启'" @click="reopenTask" /></view>
      <!-- 「按技能找人」跳人才库（talents）：专员、合作商家都没有那页的权限，不显示 -->
      <view class="match-card"><view class="k-between"><text class="section-title">技能匹配</text><view v-if="!onlineStaff && !merchantStaff" class="k-row k-gap4" hover-class="k-press" @click="findTalents"><text class="k-meta">按技能找人</text><k-icon name="chevron-right" :size="15" color="ink" /></view></view><text class="match-card__rate">报名者平均匹配度　<text class="k-green">{{ T.avgMatch || '—' }}</text></text><view class="match-chips"><k-chip v-if="T.skills[0]" tone="green"><text>{{ T.skills[0] }}</text></k-chip><k-chip v-if="T.skills[1]" tone="green"><text>{{ T.skills[1] }}</text></k-chip><k-chip v-if="T.skills[2]" tone="green"><text>{{ T.skills[2] }}</text></k-chip></view></view>
      <view class="requirements"><text class="section-title">任务要求</text><text v-if="T.requirements[0]">• {{ T.requirements[0] }}</text><text v-if="T.requirements[1]">• {{ T.requirements[1] }}</text><text v-if="T.requirements[2]">• {{ T.requirements[2] }}</text></view>
      <view class="apply-bar"><view class="k-between"><text>名额　 <text class="k-red">{{ T.headcount || 0 }}</text> 人</text><button v-if="T.canAuditApplications" class="application-count" hover-class="k-press-s" @click="openTaskApplications(T)">已报名 {{ T.applied || 0 }} 人 · 审核</button><text v-else>已报名　 <text class="k-red">{{ T.applied || 0 }}</text> 人</text></view></view>
      <view v-if="T.canAuditApplications" class="application-review">
        <view><text class="section-title">报名审核</text><text class="k-meta">待审核 {{ T.pendingApplications || 0 }} 人，通过后进入下方接单人列表</text></view>
        <k-button type="primary" block :label="Number(T.pendingApplications) ? '审核报名（' + T.pendingApplications + '）' : '查看报名记录'" @click="openTaskApplications(T)" />
      </view>
      <!-- 接单人一人一行：名字 · 状态 · 最后提交时间；进行中还没发素材的标「未发素材」提醒门店发（V37）。点行进交付记录 / 验收页 -->
      <view class="people"><view class="k-between"><text v-if="T.rewardText" class="fc-note">{{ T.rewardText }}</text><text class="section-title">接单人（{{ people.length }}）</text><text class="k-link" @click="loadPeople">刷新</text></view>
        <text v-if="peopleLoading && !people.length" class="people__empty">正在读取接单人…</text>
        <text v-else-if="!people.length" class="people__empty">{{ T.hasExt ? '还没有人接单（报名审核通过即接单）' : '还没有人接单' }}</text>
        <view v-for="pp in people" :key="pp.appId" class="person" hover-class="k-press" @click="openAssignment(pp.appId)"><view class="person__copy"><text class="person__name">{{ pp.name }}</text><text class="person__meta">{{ pp.statusLabel }}{{ pp.noMaterial ? ' · 未发素材' : '' }}{{ pp.lastSubmitTime ? ' · 最后提交 ' + pp.lastSubmitTime : '' }}</text></view><k-icon name="chevron-right" :size="18" color="muted" /></view>
      </view>
      </template>
    </view>

    <view v-else-if="s === 3" class="k-body k-pad-tab group-page">
      <text v-if="A.rewardText" class="fc-note">{{ A.rewardText }}</text><view class="announcement"><view class="k-between"><text class="section-title">任务公告</text><text class="k-green">置顶</text></view><text>{{ A.announcement }}</text><text>• 任务主题：{{ A.title }}</text><text>• 预计完成：{{ A.deadline || '—' }}</text><text>• 交付物：{{ A.deliverables }}</text></view>
      <!-- 退回原因（V41：最多 5000 字，保留换行，长的先显示一段）和退回时附的截图 -->
      <view v-if="latest && (latest.comment || latestShots.length)" class="review-state"><text class="review-text">{{ latest.status === 'returned' ? '退回原因：' : '验收评语：' }}{{ latest.comment ? (reasonOpen ? latest.comment : fold(latest.comment)) : '（只附了截图）' }}</text><text v-if="(latest.comment || '').length > 300" class="k-link" @click="reasonOpen = !reasonOpen">{{ reasonOpen ? '收起' : '展开全部' }}</text><view v-if="latestShots.length" class="material-photos"><image v-for="(shotImg, shotIndex) in latestShots" :key="shotImg" :src="abs(shotImg)" mode="aspectFill" @click="previewMaterial(latestShots, shotIndex)" /></view></view><text class="system-msg">系统消息　{{ A.worker }} 于 {{ A.takenTime || '—' }} 接单</text>
      <view v-if="A.material" class="chat left"><image :src="storeAvatar" mode="aspectFill" /><view><text class="chat__name">{{ A.storeName }}</text><view class="file-bubble" hover-class="k-press-s" @click="openMaterial"><view class="file-icon"><k-icon name="file-text" :size="27" color="white" /></view><view><text>{{ A.materialName || '参考素材' }}</text><text>点击复制链接</text></view><k-icon name="download" :size="24" color="ink" /></view></view></view>
      <view v-if="A.material" class="chat left"><image :src="storeAvatar" mode="aspectFill" /><view><text class="chat__name">{{ A.storeName }}</text><view class="bubble"><text>以上是参考素材，请合理使用～</text></view></view></view>
      <!-- 发给这位接单人的素材（V37，可多次补发）：文字 + 图片 + 文件（V41），接单人在交付页「门店素材」里看。长文字先显示一段 -->
      <view v-for="materialItem in A.materials || []" :key="materialItem.materialId" class="chat left"><image :src="storeAvatar" mode="aspectFill" /><view><text class="chat__name">{{ materialItem.sentBy }} · {{ materialItem.time }} 发素材</text><view v-if="materialItem.content" class="bubble material-bubble"><text>{{ openTexts[materialItem.materialId] ? materialItem.content : fold(materialItem.content) }}</text><text v-if="materialItem.content.length > 300" class="k-link" @click="toggleText(materialItem.materialId)">{{ openTexts[materialItem.materialId] ? '收起' : '展开全部' }}</text></view><view v-if="materialItem.images.length" class="material-photos"><image v-for="(materialImg, materialImgIndex) in materialItem.images" :key="materialImg" :src="abs(materialImg)" mode="aspectFill" @click="previewMaterial(materialItem.images, materialImgIndex)" /></view><view v-for="matFile in materialItem.files || []" :key="matFile.fileId" class="file-bubble" hover-class="k-press-s" @click="fileMenu(matFile)"><view class="file-icon"><k-icon :name="matFile.kind === 'archive' ? 'archive' : 'file-text'" :size="24" color="white" /></view><view class="file-info"><text class="file-name">{{ matFile.name }}</text><text>{{ matFile.sizeLabel }} · {{ fileTapHint(matFile) }}</text></view></view></view></view>
      <text v-if="!(A.materials || []).length && A.canSendMaterial" class="system-msg">还没给接单人发素材，点下方「发素材」发文字、图片和文件</text>
      <view v-if="latest" class="chat right"><view><text class="chat__name">{{ latest ? latest.time : '' }}</text><view class="bubble bubble--mine"><text>{{ latest && latest.note ? latest.note : '（提交时没有填写说明）' }}</text></view></view><image :src="DEFAULT_AVATAR" mode="aspectFill" /></view>
      <view class="submit-card"><view class="k-between"><text class="section-title">{{ latest ? '提交成果（第 ' + latest.round + ' 轮 · ' + latest.statusLabel + '）' : '尚未提交成果' }}</text><text class="k-meta">{{ latest ? latest.time : '' }}</text></view><text v-if="latestLinks.length !== 1" class="submit-card__label">成果链接 / 分享口令{{ latestLinks.length > 1 ? '（共 ' + latestLinks.length + ' 个）' : '' }}</text><view v-for="(lk, lkIndex) in latestLinks" :key="lkIndex" class="link-block"><view class="k-between"><text class="submit-card__label">{{ latestLinks.length > 1 ? '链接 ' + (lkIndex + 1) : '成果链接 / 分享口令' }}</text><view class="url-acts"><text v-if="linkParts(lk).url" class="url__copy" @click="copyLink(lk)">复制链接</text><text v-if="linkParts(lk).url !== lk" class="url__copy" @click="copyLinkText(lk)">复制全文</text></view></view><view class="url url--text"><text v-if="linkParts(lk).before">{{ linkParts(lk).before }}</text><text v-if="linkParts(lk).url" class="url__link" @click="copyLink(lk)">{{ linkParts(lk).url }}</text><text v-if="linkParts(lk).after">{{ linkParts(lk).after }}</text></view></view><view v-if="!latestLinks.length" class="url url--text"><text>（没有链接）</text></view><view class="photos"><image v-for="(img, ii) in latestImages" :key="img" :src="img" mode="aspectFill" @click="previewResult(ii)" /></view><text class="submit-card__label">补充说明（选填）</text><view class="supplement"><text>{{ latest && latest.note ? latest.note : '—' }}</text></view></view>
      <view class="deadline" :class="{ 'is-over': overdue }"><text>{{ countdown }}</text><k-button size="md" @click="goInspect" :label="inspectBtnText" /></view>
    </view>

    <view v-else class="k-body k-pad-tab inspect-page">
      <view class="result-card"><text class="section-title">用户提交的成果</text><view class="result-card__body"><image :src="latestImages[0] || '/static/media/states-empty-box.jpg'" mode="aspectFill" @click="previewResult(0)" /><view><text>{{ noteFirstLine }}</text><view v-for="(lk, lkIndex) in latestLinks" :key="lkIndex" class="result-link-item"><text v-if="latestLinks.length > 1" class="result-link__label">链接 {{ lkIndex + 1 }}</text><view class="result-link"><text v-if="linkParts(lk).before">{{ linkParts(lk).before }}</text><text v-if="linkParts(lk).url" class="result-link__url" @click="copyLink(lk)">{{ linkParts(lk).url }}</text><text v-if="linkParts(lk).after">{{ linkParts(lk).after }}</text></view><view class="result-link__acts"><text v-if="linkParts(lk).url" @click="copyLink(lk)">复制链接</text><text v-if="linkParts(lk).url !== lk" @click="copyLinkText(lk)">复制全文</text></view></view><text v-if="!latestLinks.length">（没有链接）</text><text>提交时间：{{ latest ? latest.time : '—' }}</text></view></view></view>
      <view class="inspection"><text class="section-title">验收结果</text>
        <view v-if="A.rewardMode==='per_item' && !A.settlement" class="fc-field">
          <text class="fc-note">本次交付 {{ latest ? latest.submittedCount : '—' }} 条，接单人报酬 ¥{{ (Number(A.unitRewardFen)/100).toFixed(2) }} / 合格条。</text>
          <text class="field-title">验收合格条数</text>
          <input class="fc-input" type="number" :value="qualifiedCount" :disabled="!canReview || reviewBusy" maxlength="3" placeholder="请核对成果后填写" @input="qualifiedCount=$event.detail.value" />
          <text class="fc-note">{{ qualifiedPreview }}；无合格成果请退回修改。部分通过会结束本次接单，请先核对数量。</text>
        </view><view v-if="A.canReview" class="decision"><view class="decision__pass" :class="{unavailable: !canReview || reviewBusy}" hover-class="k-press-s" @click="pass"><k-icon name="circle-check" :size="24" color="white" /><text>验收通过</text></view><view class="decision__return" :class="{unavailable: !canReview || reviewBusy}" hover-class="k-press-s" @click="reject"><k-icon name="square-pen" :size="23" color="red" /><text>退回修改</text></view></view><text v-if="latest" class="review-state">当前状态：{{ latest.statusLabel }}{{ latest.comment ? ' · ' + fold(latest.comment, 40) : '' }}{{ latestShots.length ? '（附 ' + latestShots.length + ' 张截图）' : '' }}</text><text v-if="reviewTip" class="k-alert">{{ reviewTip }}</text><text class="field-title">评语 <text class="k-meta">（选填）</text></text><view class="comment" hover-class="k-press" @click="editComment"><text>{{ comment || '（选填）点击填写评语' }}</text><text>{{ comment.length }}/100</text></view></view>
      <view v-if="!onlineStaff" class="payment"><text class="section-title">验收结算</text><view class="pay-row"><text>{{ A.rewardMode==='per_item' && !A.settlement ? '待验收报酬' : '佣金（元）' }}</text><text>{{ A.rewardMode==='per_item' && !A.settlement ? qualifiedPreview : (A.commission || '—') }}</text></view><text class="field-title">结算方式</text><view class="pay-method"><view class="pay-check"><k-icon name="check" :size="12" color="white" :stroke="3" /></view><view><text>线下结算（门店直接付款给接单人）</text><text>验收后生成结算单，门店线下付款并登记凭证，接单人确认收款；税费由付款门店依法处理</text></view></view><k-button block size="md" :disabled="payoutBusy" @click="onSettle" :label="payoutBusy ? '正在处理…' : settleBtnText" /></view>
      <view v-if="A.canPay && A.rewardMode==='per_item' && platformFeeUnit>0" class="payment-evidence"><text class="section-title">商家应付平台费</text><text>{{A.settlement ? A.settlement.qualifiedCount : qualifiedValid ? qualifiedCount : '—'}} 条合格 × ¥{{(platformFeeUnit/100).toFixed(2)}} = ¥{{A.settlement ? (Number(A.settlement.platformFeeFen)/100).toFixed(2) : qualifiedValid ? (Number(qualifiedCount)*platformFeeUnit/100).toFixed(2) : '—'}}</text><text>平台费与接单人报酬分别结算。</text></view>
      <view v-if="A.recipient" class="payment-evidence"><text class="section-title">接单人收款信息</text><template v-if="A.recipient.submitted"><text>真实姓名：{{ A.recipient.realName }}</text><text v-if="A.recipient.method==='alipay'" class="k-link" @click="copy(A.recipient.account,'支付宝账号已复制')">支付宝：{{ A.recipient.account }} · 复制</text><image v-else :src="absUrl(A.recipient.qrUrl)" mode="aspectFit" style="width:180px;height:180px" @click="previewRecipient"/><text>付款前请核对收款人姓名和账号。</text></template><text v-else>等待接单人在任务交付页提交真实姓名和收款二维码或支付宝账号。</text></view>
      <view v-if="A.settlement && !onlineStaff" class="payment-evidence"><text v-if="A.settlement.method">已登记方式：{{ A.settlement.method }}</text><text v-if="A.settlement.ref">流水号：{{ A.settlement.ref }}</text><text v-if="A.settlement.voucher" class="k-link" @click="previewPayoutVoucher">查看已登记付款凭证</text><text v-if="A.settlement.dispute">{{ A.settlement.status === 'disputed' ? '待核实争议：' : '原争议记录：' }}{{ A.settlement.dispute }}</text><text v-if="A.settlement.status === 'disputed'">请主理人核实实际付款后更正方式、流水号和凭证。结算金额不变，原凭证保留记录，更正不会发起转账。</text><text v-if="A.settlement.correctionCount && A.settlement.status === 'payout_registered'">付款凭证已更正，等待接单人重新核对并确认收款。</text></view>
      <text v-if="A.settlement && A.rewardText" class="fc-note">{{ A.rewardText }}</text><view v-if="A.settlement" class="paid"><view class="paid__check"><k-icon name="check" :size="29" color="white" :stroke="3" /></view><view class="k-flex1"><text>{{ A.settlement ? A.settlement.statusLabel : '' }}</text><text>结算单号 {{ A.settlement ? A.settlement.settleNo : '' }}</text></view><text>{{ A.settlement ? A.settlement.amount : '' }}</text></view>
      <view v-if="A.settlement" class="pay-notice"><view class="notice-icon"><k-icon name="heart" :size="19" color="white" fill="white" /></view><view class="k-flex1"><text>站内通知</text><text>已通知接单人（站内信）</text></view><k-icon name="chevron-down" :size="16" color="muted" /><text>结算金额　<text class="k-green">{{ A.settlement ? A.settlement.amount : '' }}</text></text></view>
    </view>

    <view v-if="a && s >= 3" class="contact-task"><k-button v-if="s === 3 && A.canSendMaterial" class="material-btn" type="secondary" block icon="send" :label="(A.materials || []).length ? '补发素材' : '发素材'" @click="openMaterialPanel" /><k-button type="outline" block icon="message-circle" @click="go(R.chat + '?appId=' + A.appId)" label="联系接单人" /></view>
    <!-- 两个弹窗：遮罩挡住了页面滚动（touchmove），图片和文件多了以后在中间的 scroll-view 里滚；输入框放在 scroll-view 外面（原生层不跟着滚） -->
    <view v-if="materialOpen" class="return-mask" @touchmove.stop.prevent>
      <view class="return-panel" role="dialog" aria-label="发素材">
        <text class="section-title">发素材给接单人</text><text class="panel-hint">写清拍摄或写作要点（最多 1 万字），可以附图片和文件。接单人会收到消息，在任务交付页查看；不等素材也能交付。</text>
        <!-- 小程序 textarea 是原生层、盖在页面最上面（连底部导航也压住）：不在输入时换成同样外观的 view，免得抢走别处的点击。
             不写 maxlength 时小程序只能输 140 字；写成 10000 的话粘贴超长会被悄悄截掉、截短的照样发出去。
             所以写 -1（不限），超过 1 万字时字数变红，发送前拦下并说明 -->
        <textarea v-if="editingMaterial" v-model="materialText" :disabled="materialBusy" :maxlength="-1" placeholder="例如：主推招牌拿铁，拍店内全景和窗边座位，文案突出海边慢生活" :show-confirm-bar="false" @input="materialError=''" :focus="true" auto-focus @blur="materialText = $event.detail.value; editingMaterial = false" />
        <view v-else class="online-area-idle" hover-class="k-press" @click="!materialBusy && (editingMaterial = true)"><text :class="{ 'k-placeholder': !materialText }">{{ materialText || '例如：主推招牌拿铁，拍店内全景和窗边座位，文案突出海边慢生活' }}</text></view>
        <text class="k-meta" :class="{ 'k-alert': textLen(materialText) > MAX_TEXT }">{{ countText(materialText, MAX_TEXT) }}</text>
        <scroll-view scroll-y class="panel-scroll"><view class="panel-scroll__body">
          <view v-if="materialImages.length" class="material-photos"><image v-for="(materialImg, materialImgIndex) in materialImages" :key="materialImg" :src="abs(materialImg)" mode="aspectFill" @click="editMaterialImage(materialImgIndex)" /></view>
          <view v-for="(pickFile, pickIndex) in materialFiles" :key="pickFile.fileId" class="pick-file"><k-icon :name="pickFile.kind === 'archive' ? 'archive' : 'file-text'" :size="18" color="ochre" /><text class="pick-file__name">{{ pickFile.name }}</text><text class="k-meta">{{ pickFile.sizeLabel }}</text><text class="k-link" @click="removeMaterialFile(pickIndex)">移除</text></view>
          <view class="pick-actions"><k-button type="outline" size="sm" icon="image-plus" :disabled="materialBusy || uploading || materialImages.length >= MAX_IMAGES" :label="(uploading ? '正在上传…' : '添加图片') + '（' + materialImages.length + '/' + MAX_IMAGES + '）'" @click="addMaterialImages" /><k-button type="outline" size="sm" icon="plus" :disabled="materialBusy || uploading || materialFiles.length >= MAX_FILES" :label="'添加文件（' + materialFiles.length + '/' + MAX_FILES + '）'" @click="addMaterialFiles" /></view>
          <text class="k-meta upload-note">图片一次可以多选，每次最多 {{ MAX_IMAGES }} 张；原图、大量图片或文档，请打包成压缩包（zip / rar / 7z）或 PDF、Word、Excel、PPT 文件一起发，单个不超过 {{ MAX_FILE_MB }}MB，每次最多 {{ MAX_FILES }} 个。</text>
        </view></scroll-view>
        <!-- 上传进度（灰字）、哪张 / 哪个文件没加上（红字）和发送失败放在按钮上面，不跟着图片滚走 -->
        <text v-if="uploadNote" class="upload-note" :class="uploading ? 'k-meta' : 'k-alert'">{{ uploadNote }}</text>
        <text v-if="materialError" class="k-alert">{{ materialError }}</text>
        <view class="return-actions"><k-button type="outline" :disabled="materialBusy || uploading" @click="closeMaterialPanel" label="取消" /><k-button :disabled="materialBusy || uploading" :label="materialBusy ? '请稍候…' : (uploading ? '还在上传…' : '发送')" @click="sendMaterial" /></view>
      </view>
    </view>
    <view v-if="returnOpen" class="return-mask" @touchmove.stop.prevent>
      <view class="return-panel" role="dialog" aria-label="退回修改">
        <text class="section-title">退回修改</text><text class="panel-hint" :class="{ 'k-alert': returnLate }">{{ returnHint }}</text>
        <!-- 和发素材一样不限长度（写 5000 的话粘贴超长会被悄悄截掉），超过 5000 字时字数变红，确认前拦下 -->
        <textarea v-if="editingReturn" v-model="returnReason" :disabled="reviewBusy" :maxlength="-1" placeholder="例如：第 2 张图偏暗，封面标题换成店名；具体位置见截图" :show-confirm-bar="false" @input="reviewError=''" :focus="true" auto-focus @blur="returnReason = $event.detail.value; editingReturn = false" />
        <view v-else class="online-area-idle" hover-class="k-press" @click="!reviewBusy && (editingReturn = true)"><text :class="{ 'k-placeholder': !returnReason }">{{ returnReason || '例如：第 2 张图偏暗，封面标题换成店名；具体位置见截图' }}</text></view>
        <text class="k-meta" :class="{ 'k-alert': textLen(returnReason) > MAX_RETURN_TEXT }">{{ countText(returnReason, MAX_RETURN_TEXT) }}</text>
        <scroll-view scroll-y class="panel-scroll"><view class="panel-scroll__body">
          <view v-if="returnImages.length" class="material-photos"><image v-for="(shotImg, shotIndex) in returnImages" :key="shotImg" :src="abs(shotImg)" mode="aspectFill" @click="editReturnShot(shotIndex)" /></view>
          <view class="pick-actions"><k-button type="outline" size="sm" icon="image-plus" :disabled="reviewBusy || returnUploading || returnImages.length >= MAX_SHOTS" :label="(returnUploading ? '正在上传…' : '添加截图') + '（' + returnImages.length + '/' + MAX_SHOTS + '）'" @click="addReturnShots" /></view>
        </view></scroll-view>
        <text v-if="returnNote" class="upload-note" :class="returnUploading ? 'k-meta' : 'k-alert'">{{ returnNote }}</text>
        <text v-if="reviewError" class="k-alert">{{ reviewError }}</text>
        <view class="return-actions"><k-button type="outline" :disabled="reviewBusy || returnUploading" @click="returnOpen=false" label="取消" /><k-button :disabled="reviewBusy || returnUploading" :label="reviewBusy ? '正在退回…' : (returnUploading ? '截图上传中…' : '确认退回')" @click="submitReturn" /></view>
      </view>
    </view>
    <!-- 2026-11-03 主人：简化 —— 登记付款改成一个底部面板（和「退回修改」同一种写法）：付款方式按钮组、流水号输入框、凭证照片格、一个「登记付款」按钮。
         之前要连过 付款方式菜单 → 流水号输入框 → 「请上传凭证」提示 → 相册 四个弹窗。更正争议凭证时面板顶上写明「这是更正」，提交前保留一次确认（涉及钱）。
         整个面板是一个 scroll-view：内容比屏幕高时在面板里滚（遮罩拦了页面的 touchmove） -->
    <view v-if="payoutOpen" class="return-mask" @touchmove.stop.prevent>
      <scroll-view scroll-y class="return-panel pay-panel" role="dialog" :aria-label="payoutCorrecting ? '更正付款凭证' : '登记付款'"><view class="pay-panel__body">
        <text class="section-title">{{ payoutCorrecting ? '更正付款凭证' : '登记线下付款' }}</text>
        <text v-if="payoutCorrecting" class="panel-hint k-alert">这是更正：原结算金额 {{ A.settlement ? A.settlement.amount : '' }} 不变，只登记更正记录、不会转账；提交后接单人重新核对到账并确认收款。</text>
        <text v-else class="panel-hint">结算金额 {{ A.settlement ? A.settlement.amount : '' }}。门店线下付款之后在这里登记付款方式和凭证，接单人确认收款后结算完成。平台不做任何自动转账。</text>
        <view v-if="payoutCorrecting" class="pay-field"><text class="pay-field__k">核实与更正说明<text class="k-alert">（必填，200 字内）</text></text>
          <textarea v-if="editingPayoutNote" v-model="payoutNote" class="pay-note" :disabled="payoutBusy" maxlength="200" placeholder="请说明核实结果及更正内容" placeholder-class="k-placeholder" :show-confirm-bar="false" @input="payoutError=''" :focus="true" auto-focus @blur="payoutNote = $event.detail.value; editingPayoutNote = false" />
          <view v-else class="online-area-idle pay-note" hover-class="k-press" @click="!payoutBusy && (editingPayoutNote = true)"><text :class="{ 'k-placeholder': !payoutNote }">{{ payoutNote || '请说明核实结果及更正内容' }}</text></view>
        </view>
        <view class="pay-field"><text class="pay-field__k">付款方式</text><view class="pay-methods"><view v-for="pm in payoutMethods" :key="pm" class="pay-methods__btn" :class="{ on: payoutMethod === pm }" hover-class="k-press-s" @click="payoutMethod = pm"><text>{{ pm }}</text></view></view></view>
        <view class="pay-field"><text class="pay-field__k">付款流水号<text class="k-meta">（选填，64 字内）</text></text><input class="pay-input" :value="payoutRef" :disabled="payoutBusy" maxlength="64" placeholder="银行 / 转账记录里的单号" placeholder-class="k-placeholder" @input="payoutRef = $event.detail.value; payoutError = ''" /></view>
        <view class="pay-field"><text class="pay-field__k">付款凭证<text class="k-alert">（必填）</text></text>
          <view class="pay-voucher" hover-class="k-press" @click="pickVoucher"><image v-if="payoutVoucher" :src="abs(payoutVoucher)" mode="aspectFill" /><view v-else class="pay-voucher__empty"><k-icon name="image-plus" :size="28" color="muted" /><text>{{ voucherUploading ? '正在上传…' : '点这里选一张付款截图或收据照片' }}</text></view></view>
          <text class="k-meta">{{ payoutVoucher ? (voucherUploading ? '正在上传新的凭证…' : '点图片可以换一张；接单人会看到付款方式与凭证') : '接单人会看到付款方式与凭证' }}</text>
        </view>
        <text v-if="payoutError" class="k-alert">{{ payoutError }}</text>
        <view class="return-actions"><k-button type="outline" :disabled="payoutBusy || voucherUploading" @click="payoutOpen = false" label="取消" /><k-button :disabled="payoutBusy || voucherUploading" :label="payoutBusy ? '正在登记…' : (voucherUploading ? '凭证上传中…' : (payoutCorrecting ? '确认更正' : '登记付款'))" @click="submitPayout" /></view>
      </view></scroll-view>
    </view>
    <!-- 发布屏只有操作条，不要底栏（和招募表一样）。2026-11-03 主人：简化 —— 按钮上面一行一直写着还差什么 / 可以提交（和招募表一样），提交不再弹「确认提交？」 -->
    <view v-if="s === 1" class="fc-bar"><view class="fc-bar__todo" :class="{ 'fc-bar__todo--err': tried && todoKeys.length, 'fc-bar__todo--ok': !todoKeys.length }" hover-class="k-press" @click="showTodo"><text>{{ todoText }}</text></view><view class="fc-bar__btns"><fc-kefu /><view class="fc-btn" hover-class="k-press-s" @click="publish"><text>{{ merchantStaff ? '提交' : '提交审核' }}</text></view></view></view>
    <!-- 专员的底栏第二格是「报名」（报名列表），任务 / 交付 / 验收都是从工作台进来的，亮「工作台」 -->
    <k-tabbar v-if="s !== 1" mode="staff" :active="onlineStaff ? 'work' : 'business'" />
    <fc-sheet v-if="sheetConf" :title="sheetConf.title" :options="sheetConf.options" :value="sheetConf.value" :empty-label="sheetConf.emptyLabel" :custom-label="sheetConf.customLabel" :custom-title="sheetConf.customTitle" :custom-hint="sheetConf.customHint" :custom-max="sheetConf.customMax" @confirm="confirmSheet" @cancel="sheetKey = ''" />
  </view>
  </k-feature-gate>
</template>

<script setup>
// ---------------------------------------------------------------------------
// 线上任务（门店侧）接入情况：
//   s=1 发布（2026-10-18 改成分组表单，直接在表里填；2026-10-31 R7 换 form-clean.scss 版式，不常用的收进「更多选填」）：标题 / 类型 / 交付物 / 截止 / 预计耗时 / 佣金 / 名额 / 验收标准 / 我们希望你 + 描述（按模板生成，非 AI），提交后由平台审核上架
//   s=2 任务列表（2026-11-03 简化：每张卡写报名 / 待验收）→ 任务详情：说明、工时、佣金、截止、所需技能、要求、名额与报名数、接单人一人一行 → 点行进交付页
//   s=3 交付记录：任务公告、接单时间、最近一轮成果（链接 / 图片 / 说明）、截止倒计时
//   s=4 验收结算：通过 / 退回修改；通过后生成结算单，门店线下付款并在底部面板登记凭证（能不能登记看服务端 canPay），接单人确认收款。平台不做任何自动转账
// ---------------------------------------------------------------------------
import { ref, computed, watch, onUnmounted } from 'vue'
import MerchantAgreement from './components/merchant-agreement.vue'
const agreementRef=ref(null)
import { onShow, onHide, onUnload } from '@dcloudio/uni-app'
import { useScreen, go, back, toast } from '@/common/screen.js'
import { apiOnlineTasks, apiOnlineCreate, apiOnlineTask, apiOnlineAssignments, apiOnlineAssignment, apiOnlineAccept, apiOnlinePayout } from '@/common/api.js'
import { ensureSession, currentStaffStoreId, onlineStaff, merchantStaff } from '@/common/experience.js'
import { sheet, prompt, alert, confirm, copy, shiftDate, todayCn, errText } from '@/common/ui.js'
// 「日期 | 时 | 分」滚轮的三列和换算（2026-11-03 和创建活动同一个滚轮）：纯函数在 common/activity-form.js，创建活动已经在用，主包不多占地方
import { whenColumns, whenIndex, whenPicked } from '@/common/activity-form.js'
import { absUrl, uploadTo, chooseImage, downloadDoc } from '@/common/upload.js'
import R from '@/common/routes.js'
import { apiOnlineSendMaterial } from '@/common/api.js'
import { get, post, put, request } from '@/common/request.js'
// 发素材的多选图片 / 并发上传 / 附件，退回修改的截图（V41）：staff 分包本地模块，不进主包
import { MAX_IMAGES, MAX_SHOTS, MAX_FILES, MAX_FILE_MB, MAX_TEXT, MAX_RETURN_TEXT, STAY_HINT, textLen, countText, foldText as fold, fileProblem, shortName, overPickNote,
  pickImages, uploadAll, failedNote, filesFailedNote, pickFiles, uploadMaterialFile, storeFilePath, linkPath, splitLink, splitLinks } from './online-material.js'
// 发布屏的底部弹层、操作条上的客服方块、滚到报错、锁背景：staff 分包里的，组件要显式引入，不走全局 easycom
import FcSheet from './components/fc-sheet.vue'
import FcKefu from './components/fc-kefu.vue'
import { scrollToField, lockPageScroll } from './fc-page.js'
import { ONLINE_REOPEN_API } from './task-flow-view.js'

function previewRecipient(){if(A.value?.recipient?.qrUrl)uni.previewImage({urls:[absUrl(A.value.recipient.qrUrl)]})}
let booting = true
const publicationFee = ref(null)
const publicationFeeError = ref('')
let publicationRequestKey = 'pub_'+Date.now()+'_'+Math.random().toString(36).slice(2)
async function loadPublicationFee() {
  publicationFeeError.value = ''
  try { publicationFee.value = (await get('/app/staff/publication-fees', {storeId:sid()})).data.config }
  catch(e) { publicationFeeError.value = errText(e, '发布费用读取失败，请重试') }
}
const sid = () => currentStaffStoreId() || undefined
const s = useScreen(4, {
  onLoad: async (q) => {
    await ensureSession()
    if (merchantStaff.value) await loadPublicationFee()
    // 专员（2026-10 起可以发布本店线上任务）：从工作台「发布任务」带 ?s=1 进发布页；不带任务 / 接单、也不是发布的，回工作台
    if (onlineStaff.value && !Number(q?.appId) && !Number(q?.jobId) && Number(q?.s) !== 1) { uni.redirectTo({url: R.staff}); return }
    // 商家改被退回的任务（?requestId=，来自「我发布的」详情）
    if (Number(q?.requestId)) await openResubmit(Number(q.requestId), q.storeId || sid())
    else if (Number(q?.appId)) await openAssignment(Number(q.appId))
    // 任务取不到（已删、不是这家店的）就退到任务列表，不停在一张空详情 / 空列表上（2026-11-03 复查补）
    else if (Number(q?.jobId)) { await loadTask(Number(q.jobId), Number(q.storeId) || sid()); if (!task.value) await loadTasks(); s.value = 2 }
    else if (s.value > 1) {
      // 2026-11-03 主人：简化 —— ?s=2 进来先看任务列表（小院主理人「岗位管理」、商家「线上任务与成果」都从这里进），不再自动打开第一条任务 / 第一个接单
      const loaded = await loadTasks()
      // 还没有线上任务：空列表上什么也做不了，和 initTask 一样提示后去发布屏；读取失败的已经提示过，不跳
      if (!tasks.value.length && loaded) { toast('暂无线上任务'); s.value = 1 }
      // 不带接单的 ?s=3 / ?s=4（现在没有谁这么链进来）统一落到任务列表
      else if (s.value > 2) s.value = 2
    }
    booting = false
  }
})
const titles = computed(() => [resubmit.value ? '修改线上任务' : '发布线上任务', task.value ? '任务详情' : '线上任务', a.value ? `交付 · ${a.value.title}` : '交付记录', onlineStaff.value ? '成果验收' : '验收与结算'])
// 返回：验收（4）→ 交付记录（3）→ 任务详情（2）→ 任务列表（从列表点进来的）→ 来源页。任务详情不再退到「发布线上任务」空表单 ——
// 从岗位列表「交付与结算」、报名详情、消息深链、工作台任务卡进来的人都不是从列表来的，返回直接回来源页；发布完落到详情再返回，也是回来源页。
// 从交付页退回任务详情时重新取一遍接单人（刚验收 / 退回的状态要变）
const onBack = () => {
  if (sheetKey.value) { sheetKey.value = ''; return }
  if (s.value > 2) { s.value -= 1; if (s.value === 2 && task.value) loadPeople(); return }
  if (s.value === 2 && task.value && fromList) return showTaskList()
  back()
}
// 切到第 2 屏时没有当前任务（发布完 / 深链的任务取不到、从交付页退回时任务没取到）就取任务列表；initTask 现在只取列表、不会替人打开第一条，
// 所以深链的接单（openAssignment 里按它的 jobId 加载）不用再防着它
watch(s, (v) => { if (!booting && v === 2 && !task.value) initTask() })

// ---------------- s=1 发布 ----------------
// 2026-10-18 商家端改版：各项直接在表里填（之前每一项都要点开系统输入框）。字段和服务端 KgOnlineTaskService.createTask 一致：
// 标题 / 类型 / 交付物 / 截止时间 / 佣金（分）/ 名额 / 验收标准 / 描述，外加用户端详情会显示的 预计耗时（estHours）、我们希望你（requirements，最多 3 条）
const TYPES = ['内容写作', '图片设计', '视频剪辑', '社群运营', '数据整理', '其他']
const EST_OPTS = ['1 小时内', '约 2 小时', '半天', '1 天', '2–3 天']
const unitRewardText=ref('')
const blank = () => ({ title: '', taskType: '内容写作', deliverables: '', deadline: shiftDate(todayCn(), 7) + ' 18:00', commissionFen: 0, itemsPerPerson: 1, quota: 3, criteria: '', description: '', estHours: '', requirements: [] })
const form = ref(blank())
// 佣金输入框里的原文（「12.5」这种）；合法时同步成 commissionFen，不合法时 commissionFen 记 0，提交时提示
const commissionText = ref('')
function setCommission(v) {
  commissionText.value = v
  const t = String(v || '').trim()
  form.value.commissionFen = /^\d+(\.\d{1,2})?$/.test(t) && Number(t) >= 1 && Number(t) <= 5000 ? Math.round(Number(t) * 100) : 0
}
const stepQuota = (n) => { form.value.quota = Math.min(50, Math.max(1, (Number(form.value.quota) || 1) + n)) }
// 任务类型 6 项、预计耗时 5 项 + 不选 + 自己写一个：超过 4 个不再摊开，点了从底部弹层选。一次只开一个，sheetKey 就是要改的那个 form 字段
const sheetKey = ref('')
const asOptions = (list) => list.map(t => ({ label: t, value: t }))
const openSheet = (key) => { editingText.value = ''; sheetKey.value = key }
const sheetConf = computed(() => {
  const k = sheetKey.value, f = form.value
  if (k === 'taskType') return { title: '任务类型', value: f.taskType, options: asOptions(TYPES) }
  if (k === 'estHours') return { title: '预计耗时', emptyLabel: '不选', value: f.estHours, options: asOptions(EST_OPTS), customLabel: '＋ 自己写一个', customTitle: '预计耗时', customHint: '例如：约 3 小时（16 字以内）', customMax: 16 }
  return null
})
function confirmSheet(v) {
  const k = sheetKey.value
  sheetKey.value = ''
  if (k) form.value[k] = v
}
watch(sheetKey, (key) => lockPageScroll(!!key))
watch(s, (v) => { if (v !== 1) sheetKey.value = '' })
onHide(() => lockPageScroll(false))
onUnload(() => lockPageScroll(false))
// 更多选填：预计耗时、任务描述。新发布默认收起；打开时里面已有内容就默认展开，不让人以为东西丢了
const moreOpen = ref(false)
const moreCount = (f) => [f.estHours, f.description].filter(Boolean).length
const moreFilled = computed(() => moreCount(form.value))
// 我们希望你：一行一条，最多 3 条、每条 40 字（和服务端同一个上限）
const requirementsText = computed(() => form.value.requirements.join('\n'))
const toRequirements = (text) => String(text || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean).slice(0, 3).map(x => x.slice(0, 40))
// 小程序的 textarea 是原生层、盖在最上面：不在输入时换成同样外观的 view（和岗位发布同一个做法）
const editingText = ref('')
// 微信里 blur 晚于别处的点击：打完字直接点别处、框已经卸掉时，靠这份草稿不丢字
const requirementsDraft = ref(null)
watch([editingText, moreOpen], ([key, open]) => {
  if (requirementsDraft.value === null || (key === 'requirements' && open)) return
  form.value.requirements = toRequirements(requirementsDraft.value)
  requirementsDraft.value = null
})
function endText(key, e) {
  const v = e && e.detail ? e.detail.value : undefined
  if (v !== undefined) {
    if (key === 'requirements') form.value.requirements = toRequirements(v)
    else form.value[key] = String(v).slice(0, key === 'deliverables' ? 100 : key === 'criteria' ? 200 : 300)
  }
  if (editingText.value === key) editingText.value = ''
}
// 就地提示：点过「提交审核」才标红；底部操作条上的「还差什么」不等点提交，一直算（2026-11-03）
const tried = ref(false)
const missing = computed(() => {
  const f = form.value, e = {}
  if (!f.title.trim()) e.title = '请填写任务标题'
  if (!f.deliverables.trim()) e.deliverables = '请写清要交什么（100 字以内）'
  if (perItemForm.value && !/^[1-9][0-9]{0,2}$/.test(String(f.itemsPerPerson))) e.commission='请填写 1–100 的整数条数'
  else if(perItemForm.value && Number(f.itemsPerPerson)>100)e.commission='每人最多 100 条'
  else if(perItemForm.value && (!/^\d+(\.\d{1,2})?$/.test(unitRewardText.value) || Number(unitRewardText.value)<1 || Number(unitRewardText.value)*Number(f.itemsPerPerson)>5000))e.commission='请填写每条接单人报酬，至少1元且单人最高报酬不超过5000元'
  else if (!perItemForm.value && !f.commissionFen) e.commission = commissionText.value ? '佣金 1–5000 元，最多两位小数' : '请填写单人佣金'
  if (!f.criteria.trim()) e.criteria = '请写清怎样算验收通过（200 字以内）'
  return e
})
const ferr = computed(() => (tried.value ? missing.value : {}))
// 2026-11-03 主人：简化 —— 底部提交栏上面一行一直写着还差哪几项（点了标红、滚到第一项）；都填好了写「可以提交」。有了这一行，提交就不再弹「确认提交？」
const TODO_NAMES = { title: '任务标题', deliverables: '交付物', commission: '接单人报酬', criteria: '验收标准' }
const todoKeys = computed(() => Object.keys(TODO_NAMES).filter(k => missing.value[k]))
const todoText = computed(() => (todoKeys.value.length ? '还差：' + todoKeys.value.map(k => TODO_NAMES[k]).join('、') + '（点这里去填）' : '必填的都填好了，可以提交'))
function showTodo() {
  if (!todoKeys.value.length) return
  tried.value = true
  scrollToField('#of-' + todoKeys.value[0])
}
// 原来确认框里说的流程，改成一直写在表单最后：佣金怎么结、提交后谁审核上架（商家看到的是「袋鼠工作人员」，不提内部角色名）、
// 专员发的任务佣金不由专员付：提交后服务端会通知本店负责付款的人（切换前后不是同一个角色），这里先说清楚
const flowNote = computed(() => {
  const f = form.value
  if(perItemForm.value)return `接单人每条报酬 ¥${unitRewardText.value || '—'}；平台费另计 ¥3/合格条。验收后按合格条数分别结算。每人最多 ${f.itemsPerPerson || '—'} 条，共 ${f.quota} 人。提交后由袋鼠工作人员核实后上架。`
  const money = f.commissionFen ? `佣金 ¥${(f.commissionFen / 100).toFixed(2)} × ${f.quota} 人，由门店在验收后线下结算。` : '佣金由门店在验收后线下结算。'
  return money + `提交后由${merchantStaff.value ? '袋鼠工作人员核实后上架' : '平台审核上架'}${onlineStaff.value ? '，并通知本店负责付款的人' : ''}。`
})
// 2026-11-03 主人：简化 —— 预计完成时间默认就是 7 天后 18:00（blank() 里），点了用一个「日期 | 时 | 分」滚轮改（今天起一年内、每 5 分钟一格）。
// 之前是 日历 → 时刻菜单 → 「其他时刻」再手敲 三步。存的、提交的还是 yyyy-MM-dd HH:mm
const when = computed(() => whenColumns(todayCn(), 366))
const toWhen = (text) => { const m = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})$/.exec(String(text || '')); return m ? { date: m[1], time: m[2] } : { date: '', time: '' } }
const fromWhen = (w) => (w && w.date ? w.date + ' ' + (w.time || '00:00') : '')
const deadlineCalendar=ref(false)
const deadlineWhen = computed(() => toWhen(form.value.deadline))
const setDeadline = (e) => {
  const w = whenPicked(e && e.detail && e.detail.value, when.value.dates)
  if (w.date) form.value.deadline = fromWhen(w)
}
// 只改显示（2026年11月8日 18:00），存的、提交的还是 yyyy-MM-dd HH:mm
const whenText = (text) => {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}:\d{2})$/.exec(text || '')
  return m ? `${m[1]}年${Number(m[2])}月${Number(m[3])}日 ${m[4]}` : String(text || '')
}
const deadlineLabel = computed(() => whenText(form.value.deadline))
function generate() {
  const f = form.value
  if (!f.title || !f.deliverables) return toast('先填写标题和交付物')
  f.description = `本任务为「${f.title}」（${f.taskType}）。请交付：${f.deliverables}。` + (f.criteria ? `验收标准：${f.criteria}。` : '') + `请在 ${f.deadline} 前提交成果，门店验收通过后线下结算佣金。`
  f.description = f.description.slice(0, 300)
  toast('已按模板生成，可点击修改')
}
// 商家被退回的任务：表里带上原来填的，改完 PUT 需求（V63，和发布同一份字段）；截止时间如果已经过了，提交时服务端会提示
const resubmit = ref(null)
const perItemForm = computed(()=>merchantStaff.value && (!resubmit.value || resubmit.value.rewardMode==='per_item'))
const deadlineText = (v) => { const t = String(v || '').replace('T', ' ').slice(0, 16); return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(t) ? t : '' }
async function openResubmit(requestId, storeId) {
  try {
    const d = (await get('/app/staff/merchant/requests/' + requestId, { storeId })).data || {}
    if (!d.canEdit) { toast('这条需求现在不能修改'); return back() }
    const j = d.job || {}, fen = Number(j.commissionFen) || 0
    form.value = { ...blank(), title: d.title || '', taskType: TYPES.includes(j.taskType) ? j.taskType : '其他', deliverables: j.deliverables || '', deadline: deadlineText(j.deadlineTime) || blank().deadline,
      commissionFen: fen, itemsPerPerson: Number(j.itemsPerPerson)||1, quota: Number(j.headcount) || 3, criteria: j.criteria || '', description: j.content && j.content !== j.deliverables ? j.content : '', estHours: j.estHours || '', requirements: toRequirements(j.requirement) }
    commissionText.value = fen ? String(fen / 100) : ''
    unitRewardText.value=j.unitRewardFen?String(Number(j.unitRewardFen)/100):''
    moreOpen.value = moreCount(form.value) > 0
    resubmit.value = { requestId, storeId, rewardMode:j.rewardMode, reason: d.returnReason || '' }
  } catch (e) {
    toast(errText(e, '读取失败，请重试'))
    back()
  }
}
// 连点「发布任务」会重复建任务
let publishing = false
async function publish() {
  if (!/^[1-9][0-9]?$/.test(String(form.value.quota)) || Number(form.value.quota)>50) return toast('名额请填写1–50的整数')
  form.value.quota=Number(form.value.quota)
  const f = form.value
  tried.value = true
  // 就地标红之外，滚到从上往下第一个错；提示和拦截照旧
  const firstErr = ['title', 'deliverables', 'commission', 'criteria'].find(k => ferr.value[k])
  if (firstErr) scrollToField('#of-' + firstErr)
  if (!f.title) return toast('请填写任务标题')
  if (!f.deliverables || !f.criteria) return toast('请填写交付物和验收标准')
  if(perItemForm.value && missing.value.commission)return toast(missing.value.commission)
  if (!perItemForm.value && !f.commissionFen) return toast('请填写佣金')
  if (publishing) return
  // 2026-11-03 主人：简化 —— 底栏一直写着「还差什么 / 可以提交」、表单最后写着流程（flowNote），这里不再弹「确认提交？」
  publishing = true
  try {
    if(merchantStaff.value && perItemForm.value && !(await agreementRef.value?.confirm()))return
    if(perItemForm.value){f.unitRewardFen=Math.round(Number(unitRewardText.value)*100);f.commissionFen=Number(f.itemsPerPerson)*f.unitRewardFen}
    if (resubmit.value) {
      const out = (await put('/app/staff/merchant/requests/' + resubmit.value.requestId, { ...f }, { params: { storeId: resubmit.value.storeId } })).data || {}
      await alert('已重新提交', out.message || '')
      uni.reLaunch({ url: R.staff })
      return
    }
    if (merchantStaff.value && !publicationFee.value) { await loadPublicationFee(); return toast('请确认页面中的发布费用后重新提交') }
    const feeFields = merchantStaff.value ? {publicationFeeVersion:publicationFee.value.version,publicationRequestKey} : {}
    const res = (await apiOnlineCreate({ ...f, ...feeFields }, sid())).data
    // 商家发的：回首页，「我发布的」能看到核实进度（草稿的任务详情对他没有下一步）
    if (merchantStaff.value) {
      await alert('已提交', res.message || '')
      uni.reLaunch({ url: R.staff })
      return
    }
    toast(res.message || '已提交平台审核')
    form.value = blank()
    commissionText.value = ''
    tried.value = false
    moreOpen.value = false
    await loadTask(res.jobId)
    s.value = 2
  } catch (e) {
    toast(errText(e, '发布失败'))
    if (merchantStaff.value && e.code===409) await loadPublicationFee()
  } finally {
    publishing = false
  }
}

// ---------------- s=2 任务列表 / 任务详情 ----------------
// 2026-11-03 主人：简化 —— task 为空时第 2 屏是任务列表（tasks），点一张卡 loadTask 进详情；详情里接单人（people）一人一行，点行 openAssignment 进交付页。
// 之前「点标题弹任务列表」（pickTask）、「查看交付弹接单人列表」（pickAssignment）两个弹窗都去掉了
const tasks = ref([])
const tasksLoading = ref(false)
const task = ref(null)
// 当前任务是按哪家门店取的：消息深链里的接单可能属于另一家已授权门店，取接单列表要用同一家
const taskStore = ref(null)
// 是从列表点进详情的：返回时回列表；带 jobId / appId 深链进来的返回直接回来源页
let fromList = false
async function loadTasks() {
  tasksLoading.value = true
  try {
    // 地址带了门店时（兼任的小院主理人从商家需求进来，当前门店还是自己的小院）切换任务也看那家店
    tasks.value = (await apiOnlineTasks(taskStore.value || sid())).data || []
    return true
  } catch (e) {
    toast(errText(e, '任务加载失败'))
    return false
  } finally {
    tasksLoading.value = false
  }
}
async function loadTask(jobId, storeId = sid()) {
  try {
    task.value = (await apiOnlineTask(jobId, storeId)).data
    taskStore.value = storeId
    reopenWhen.value = null
    // 接单人随任务一起取，不等它（取不到只影响那一块，详情照常显示）
    loadPeople()
  } catch (e) {
    toast(errText(e, '任务不存在'))
  }
}
// 任务详情里的接单人列表：名字 · 状态 · 最后提交时间，进行中还没发素材的带 noMaterial（V37）
const people = ref([])
const peopleLoading = ref(false)
async function loadPeople() {
  const t = task.value
  if (!t || !t.jobId) { people.value = []; return }
  peopleLoading.value = true
  try {
    const list = (await apiOnlineAssignments(t.jobId, taskStore.value || sid())).data || []
    if (task.value === t) people.value = list
  } catch (e) {
    toast(errText(e, '接单人加载失败'))
  } finally {
    peopleLoading.value = false
  }
}
async function initTask() {
  await loadTasks()
  if (tasks.value.length) fromList = false
  else { toast('暂无线上任务'); s.value = 1 }
}
// 列表上点一张卡：进那条任务的详情
const openTaskCard = (i) => {
  if (!tasks.value[i]) return
  fromList = true
  loadTask(tasks.value[i].jobId, taskStore.value || sid())
}
// 详情顶上「全部任务」、从列表进来的返回：回列表，并重新取一遍（报名 / 待验收数会变）
function showTaskList() {
  fromList = false
  task.value = null
  people.value = []
  loadTasks()
}
const T = computed(() => task.value || { skills: [], requirements: [] })
function openTaskApplications(t) {
  if (!t?.jobId || t.canAuditApplications !== true) return
  const status = Number(t.pendingApplications) > 0 ? '&status=submitted' : ''
  go(R.staffApplications + '?jobType=online&storeId=' + (taskStore.value || sid()) + '&jobId=' + t.jobId + status)
}
// 继续开启（2026-11-03）：默认新时间 = 服务端给的 reopenDeadline（7 天后 18:00，没有就本机算 7 天后 18:00），用同一个「日期 | 时 | 分」滚轮改；
// 服务端再核对至少晚 2 小时、不超过半年，并写操作日志。之前要在系统输入框里手敲「2026-11-10 18:00」
const reopening = ref(false)
const reopenWhen = ref(null)
const reopenPicked = computed(() => {
  if (reopenWhen.value) return reopenWhen.value
  const w = toWhen(T.value.reopenDeadline)
  return w.date ? w : { date: shiftDate(todayCn(), 7), time: '18:00' }
})
const reopenLabel = computed(() => whenText(fromWhen(reopenPicked.value)))
const setReopen = (e) => {
  const w = whenPicked(e && e.detail && e.detail.value, when.value.dates)
  if (w.date) reopenWhen.value = w
}
async function reopenTask() {
  const t = task.value
  if (!t || !t.canReopen || reopening.value) return
  const v = fromWhen(reopenPicked.value)
  if (!v) return toast('请先选新的预计完成时间')
  const store = taskStore.value || sid()
  reopening.value = true
  try {
    const res = await post(ONLINE_REOPEN_API(t.jobId) + '?storeId=' + store, { deadline: v })
    toast(res.msg || '已继续开启')
    await loadTask(t.jobId, store)
    loadTasks()
  } catch (e) {
    toast(errText(e, '继续开启失败'))
  } finally {
    reopening.value = false
  }
}
const findTalents = () => go(R.staffTalents + (T.value.skills.length ? '?tags=' + encodeURIComponent(T.value.skills.join(',')) : ''))

// ---------------- s=3 / s=4 ----------------
const a = ref(null)
const A = computed(() => a.value || { submissions: [] })
const platformFeeUnit = computed(() => Number(A.value.settlement ? A.value.settlement.platformFeeUnitFen : A.value.platformFeeUnitFen) || 0)
const latest = computed(() => A.value.latest || null)
const latestImages = computed(() => ((latest.value && latest.value.images) || []).map(absUrl))
// 交付记录里的头像原先是设计稿里两张真人照片（门店一张、接单人一张），会被当成本人；
// 门店用门店封面，接单人员工端拿不到头像（服务端 staffView 不下发），都退到品牌默认图（袋鼠线稿，不是任何人）
const DEFAULT_AVATAR = '/static/media/profile-avatar.jpg'
const storeAvatar = computed(() => absUrl(A.value.storeCover) || DEFAULT_AVATAR)
// 验收要看清成果：之前缩略图点了没反应；没有图片时不再拿一张房间照片充当"用户提交的成果"，改为空状态图且点了不放大
const previewResult = (i) => { if (latestImages.value.length) uni.previewImage({ urls: latestImages.value, current: latestImages.value[i] || latestImages.value[0] }) }
const comment = ref('')
const returnOpen = ref(false)
const returnReason = ref('')
// 退回原因框只在正在输入时才是真的 textarea（原生层会盖住别的按钮），平时是预览
const editingReturn = ref(false)
const reviewError = ref('')
const reviewBusy = ref(false)
const payoutBusy = ref(false)
// 退回修改附的截图（V41，最多 9 张）：上传中不能确认退回
const returnImages = ref([])
const returnUploading = ref(false)
const returnNote = ref('')
// 最近一轮退回附的截图（老后端不返回 reviewImages，按空列表处理）；退回原因长时交付记录里先显示一段
const latestShots = computed(() => (latest.value && latest.value.reviewImages) || [])
const reasonOpen = ref(false)
onShow(async () => {
  // 登记 / 更正付款的面板里会打开相册选凭证，回来触发的这次 onShow 不刷新：
  // 之前它和登记请求并发，旧数据晚到时会把刚登记好的结算状态盖回去
  if (booting || payoutBusy.value || voucherUploading.value) return
  if (s.value === 2) {
    if (task.value?.jobId) await loadTask(task.value.jobId, taskStore.value || sid())
    else await loadTasks()
    return
  }
  if (!a.value?.appId) return
  try { a.value = (await apiOnlineAssignment(a.value.appId)).data }
  catch (e) { toast(errText(e, '结算状态刷新失败')) }
})
const canReview = computed(() => A.value.canReview === true && latest.value?.status === 'submitted')
// 服务端同时校验本店编辑权限、非本人接单、报名及账号仍有效。
// 没有权限的人不显示两个按钮，改为说明为什么只能查看
const reviewTip = computed(() => {
  if (reviewError.value && !returnOpen.value) return reviewError.value
  if (A.value.reviewBlockReason) return A.value.reviewBlockReason
  return a.value && A.value.canReview !== true ? '你在本门店没有验收权限（需要「线上任务·验收」），或这是你本人接的单：只能查看，不能验收或退回' : ''
})
async function openAssignment(appId) {
  try {
    a.value = (await apiOnlineAssignment(appId)).data
    comment.value = ''
    reasonOpen.value = false
    // 待验收、已验收（有结算单；专员拿到的结算单只有单号、金额和状态）都直接进验收与结算屏
    s.value = latest.value && (['submitted', 'accepted'].includes(latest.value.status) || a.value.settlement) ? 4 : 3
    // 返回到任务详情时显示这条接单所属的任务；消息深链只带 appId，接单所属门店以服务端返回的 storeId 为准
    if (a.value?.jobId && String(task.value?.jobId) !== String(a.value.jobId)) loadTask(a.value.jobId, a.value.storeId || sid())
  } catch (e) {
    toast(errText(e, '接单记录不存在'))
  }
}
const now = ref(Date.now())
const tick = setInterval(() => { now.value = Date.now() }, 1000)
onUnmounted(() => clearInterval(tick))
// 截止前后退回的，接单人有重新提交期限（resubmitUntilTs，退回后至少 48 小时），倒计时改按它算
const countdown = computed(() => {
  const until = A.value.resubmitUntilTs || A.value.deadlineTs
  if (!until) return '没有设置预计完成时间'
  const ms = until - now.value
  if (ms <= 0) return A.value.resubmitUntilTs ? '重新提交期限已过' : '已过预计完成时间'
  const d = Math.floor(ms / 86400000), h = Math.floor(ms % 86400000 / 3600000), m = Math.floor(ms % 3600000 / 60000), sec = Math.floor(ms % 60000 / 1000)
  const p = (n) => String(n).padStart(2, '0')
  return `${A.value.resubmitUntilTs ? '重新提交还剩' : '距离预计完成'}　${d}天 ${p(h)}:${p(m)}:${p(sec)}`
})
// 过了截止（或重新提交期限）才用提醒红；还在倒计时就是普通的棕色
const overdue = computed(() => { const until = A.value.resubmitUntilTs || A.value.deadlineTs; return !!until && until <= now.value })
const accepted = computed(() => !!A.value.settlement || latest.value?.status === 'accepted')
const inspectBtnText = computed(() => (accepted.value ? '查看结算' : latest.value && latest.value.status === 'submitted' ? '去验收' : '等待提交'))
function goInspect() {
  if (accepted.value || (latest.value && latest.value.status === 'submitted')) s.value = 4
  else toast(latest.value && latest.value.status === 'returned' ? '已退回修改，等待对方重新提交' : '对方还没有提交成果')
}
const openMaterial = () => (A.value.material ? copy(absUrl(A.value.material), '素材链接已复制') : toast('没有参考素材'))

// ---------------- 发素材（V37；V41 起多选图片、并发上传、附件、1 万字） ----------------
// 门店接单后，把拍摄 / 写作素材（文字 + 最多 20 张图 + 最多 5 个压缩包或文档）发给这位接单人，可以多次补发；接单人收到消息，在交付页「门店素材」里看。
// 只是信息展示：不改成果提交和结算，接单人不等素材也能交付。按钮只在服务端说能发时出现（canSendMaterial：本店「线上任务·验收」权限、
// 接单仍在进行、不是自己的接单、结算还没确认）
const abs = absUrl
const previewMaterial = (list, i) => uni.previewImage({ urls: list.map(absUrl), current: absUrl(list[i]) })
const materialOpen = ref(false)
const materialText = ref('')
const materialImages = ref([])
// 已上传、等这次发送一起发出的附件（服务端返回的 {fileId, name, sizeLabel, kind…}）
const materialFiles = ref([])
const materialBusy = ref(false)
const materialError = ref('')
const editingMaterial = ref(false)
// 图片 / 文件正在上传：上传进度和失败汇总写在 uploadNote 里，上传中不能发送、不能关弹窗
const uploading = ref(false)
const uploadNote = ref('')
// 交付记录里哪些长文字已经展开
const openTexts = ref({})
const toggleText = (id) => { openTexts.value = { ...openTexts.value, [id]: !openTexts.value[id] } }
const uploadImage = async (path) => (await uploadTo('/app/upload/image', path)).data.url
function openMaterialPanel() {
  if (!A.value.canSendMaterial) return toast('需要本门店「线上任务·验收」权限，且接单仍在进行')
  materialText.value = ''
  materialImages.value = []
  materialFiles.value = []
  materialError.value = ''
  uploadNote.value = ''
  editingMaterial.value = false
  materialOpen.value = true
}
// 没发出去就关掉：已上传的附件顺手让服务端清掉（失败也不要紧，24 小时后会自动清理）。
// 用 request 而不是 del：主包的 common/request.js 里 del 没有别处用到、构建时会被摇掉，在这里引用它主包就要多几十字节
const dropFile = (f) => request({ url: '/app/staff/online/assignments/' + A.value.appId + '/material-files/' + f.fileId, method: 'DELETE' }).catch(() => {})
function closeMaterialPanel() {
  if (materialBusy.value || uploading.value) return
  materialFiles.value.forEach(dropFile)
  materialFiles.value = []
  materialOpen.value = false
}
// 选多了（网页版能一次选很多）只取前面能放下的，并提示「最多还能加 N 张，只加前 N 张」，不再悄悄丢掉
function takeRoom(list, left, unit, noun) {
  const over = overPickNote(list.length, left, unit, noun)
  if (over) toast(over)
  return list.slice(0, left)
}
// 一次多选（微信里一次最多 20 张），3 张一起传，进度显示「正在上传 3/12」，传不上的最后用红字说明是第几张
async function addMaterialImages() {
  if (materialBusy.value || uploading.value) return
  const left = MAX_IMAGES - materialImages.value.length
  if (left <= 0) return toast('每次最多 ' + MAX_IMAGES + ' 张图片')
  const paths = takeRoom(await pickImages(left), left, '张')
  if (!paths.length) return
  uploading.value = true
  materialError.value = ''
  uploadNote.value = '正在上传 0/' + paths.length
  try {
    const r = await uploadAll(paths, uploadImage, (done, total) => { uploadNote.value = '正在上传 ' + done + '/' + total })
    materialImages.value = materialImages.value.concat(r.urls).slice(0, MAX_IMAGES)
    uploadNote.value = failedNote(r.failedAt, r.reason)
  } finally {
    uploading.value = false
  }
}
async function editMaterialImage(i) {
  const k = await sheet(['查看大图', '移除这张'])
  if (k === 0) previewMaterial(materialImages.value, i)
  if (k === 1) materialImages.value = materialImages.value.filter((_, j) => j !== i)
}
// 添加文件：小程序只能从微信聊天记录里选（先发到「文件传输助手」），H5 从电脑上选。先在本机挡掉格式不对、超过 100MB 的，再一个一个上传（超过 8MB 的分段传，见 online-material.js uploadInParts）
async function addMaterialFiles() {
  if (materialBusy.value || uploading.value) return
  const left = MAX_FILES - materialFiles.value.length
  if (left <= 0) return toast('每次最多 ' + MAX_FILES + ' 个文件')
  // #ifdef MP-WEIXIN
  if (!(await confirm('从微信聊天里选文件', '小程序只能从微信聊天记录里选文件。请先把压缩包或文档发到「文件传输助手」或任意聊天，再回来选。支持 zip / rar / 7z 和 PDF、Word、Excel、PPT，单个不超过 ' + MAX_FILE_MB + 'MB。'))) return
  // #endif
  let picked = []
  try {
    picked = takeRoom(await pickFiles(left), left, '个', '文件')
  } catch (e) {
    return toast(errText(e, '没能打开文件选择，请重试'))
  }
  if (!picked.length) return
  // 没加上的文件：本机挡下的（格式不对、超过 10MB）和服务端拒收 / 传断了的，最后用红字逐个写明文件名和原因
  const fails = picked.filter(fileProblem).map((f) => ({ name: f.name, reason: fileProblem(f) }))
  const ok = picked.filter((f) => !fileProblem(f))
  uploading.value = true
  materialError.value = ''
  try {
    for (let i = 0; i < ok.length; i++) {
      const f = ok[i]
      const which = ok.length > 1 ? '（' + (i + 1) + '/' + ok.length + '）' : ''
      uploadNote.value = '正在上传「' + shortName(f.name) + '」' + which + STAY_HINT
      try {
        const saved = await uploadMaterialFile(A.value.appId, f, (pct) => { uploadNote.value = '正在上传「' + shortName(f.name) + '」' + which + ' ' + pct + '%' + STAY_HINT })
        materialFiles.value = materialFiles.value.concat([saved])
      } catch (e) {
        fails.push({ name: f.name, reason: errText(e, '上传失败，请重试') })
      }
    }
  } finally {
    uploading.value = false
  }
  uploadNote.value = filesFailedNote(fails)
}
// 交付记录里附件下面那行提示，和点开的菜单（fileMenu）对上：网页版都能「下载」，小程序里文档能「打开」
function fileTapHint(f) {
  let how = f.openable ? '打开或' : ''
  // #ifdef H5
  how = '下载或'
  // #endif
  return '点击' + how + '复制下载链接'
}
function removeMaterialFile(i) {
  if (materialBusy.value || uploading.value) return
  const f = materialFiles.value[i]
  if (!f) return
  materialFiles.value = materialFiles.value.filter((_, j) => j !== i)
  dropFile(f)
}
async function sendMaterial() {
  if (materialBusy.value) return
  if (uploading.value) { materialError.value = '图片或文件还在上传，请稍候'; return }
  const content = materialText.value.trim()
  if (!content && !materialImages.value.length && !materialFiles.value.length) { materialError.value = '请写几句素材说明，或添加图片、文件'; return }
  if (content.length > MAX_TEXT) { materialError.value = '素材说明太长了（现在 ' + content.length + ' 字，最多 1 万字），请删减一些，或把长文放进文档作为附件发送'; return }
  materialBusy.value = true
  materialError.value = ''
  try {
    a.value = (await apiOnlineSendMaterial(A.value.appId, { content, images: materialImages.value, files: materialFiles.value.map((f) => f.fileId) })).data
    // 附件已随素材发出，关弹窗时不再清理
    materialFiles.value = []
    materialOpen.value = false
    toast('素材已发给接单人')
  } catch (e) {
    materialError.value = errText(e, '发送失败，请重试')
    toast(materialError.value)
  } finally {
    materialBusy.value = false
  }
}
// 交付记录里点附件：小程序里 PDF / Office 文档可以打开看（右上角「…」能转发、保存），网页版直接下载；发出去的附件都能复制下载链接（3 天内有效）
async function fileMenu(f) {
  const acts = []
  // #ifdef H5
  acts.push('下载')
  // #endif
  // #ifndef H5
  if (f.openable) acts.push('打开查看')
  // #endif
  acts.push('复制下载链接')
  const i = await sheet(acts)
  if (i < 0) return
  try {
    if (acts[i] === '复制下载链接') {
      const r = (await get(linkPath(A.value.appId, f.fileId))).data
      await copy(absUrl(r.url), '下载链接已复制，3 天内有效')
      return
    }
    uni.showLoading({ title: '正在下载…', mask: true })
    try { await downloadDoc(storeFilePath(A.value.appId, f.fileId), f.ext, f.name) } finally { uni.hideLoading() }
  } catch (e) {
    toast(errText(e, '文件打开失败，请重试'))
  }
}
// 成果链接（V47 起可以是小红书、抖音的整段分享口令）：全文原样显示，其中第一个网址标出来；
// 「复制链接」只复制网址（粘贴到浏览器或对应 App 打开），文字里没有网址时复制全文；「复制全文」连口令一起复制（打开对应 App 能识别口令）。
// 2026-10-17 主人反馈：接单人一次发了几篇帖子的，一轮最多交 3 个链接或口令：一个一个显示（不止一个时标「链接 1 / 2 / 3」），各自复制。
// 服务端给拆好的 links；老后端只有 link（几个用换行隔开），自己拆
const latestLinks = computed(() => (!latest.value ? [] : (Array.isArray(latest.value.links) ? latest.value.links : splitLinks(latest.value.link))))
const linkParts = splitLink
const copyLink = (lk) => {
  if (!lk) return toast('这一轮没有提交链接')
  return linkParts(lk).url ? copy(linkParts(lk).url, '已复制成果链接，可粘贴到浏览器或对应 App 打开') : copyLinkText(lk)
}
const copyLinkText = (lk) => (lk ? copy(lk, '已复制全文，打开对应 App 即可识别口令') : toast('这一轮没有提交链接'))
const noteFirstLine = computed(() => (latest.value && latest.value.note ? latest.value.note.split('\n')[0] : '（没有补充说明）'))
async function editComment() {
  if (a.value && A.value.canReview !== true) return toast('评语随验收一起提交，你没有本门店的验收权限')
  const v = await prompt('评语（选填，100 字内）', { value: comment.value })
  if (v !== null) comment.value = v.trim().slice(0, 100)
}
function reviewAllowed() {
  if (reviewBusy.value) return false
  if (!latest.value || latest.value.status !== 'submitted') { toast('当前没有待验收的成果'); return false }
  if (!A.value.canReview) { toast('需要本门店验收权限，且不能验收自己的成果'); return false }
  return true
}
const qualifiedCount=ref('')
watch(()=>[A.value.appId,latest.value?.round],()=>{qualifiedCount.value=''})
const qualifiedValid=computed(()=>/^[1-9][0-9]{0,2}$/.test(String(qualifiedCount.value)) && Number(qualifiedCount.value)<=Number(latest.value?.submittedCount))
const qualifiedPreview=computed(()=>qualifiedValid.value ? `${qualifiedCount.value} 条 × ¥${(Number(A.value.unitRewardFen)/100).toFixed(2)} = ¥${(Number(qualifiedCount.value)*Number(A.value.unitRewardFen)/100).toFixed(2)}` : '填写合格条数后显示结算金额')
async function pass() {
  if (!reviewAllowed()) return
  if(A.value.rewardMode==='per_item' && !qualifiedValid.value)return toast('请填写不超过本次交付数的正整数；无合格成果请退回修改')
  reviewBusy.value = true
  reviewError.value = ''
  try {
    if (!(await confirm('验收通过', `通过后生成 ${A.value.rewardMode==='per_item' ? qualifiedPreview.value : A.value.commission} 的结算单。验收不会自动付款，需另行登记付款凭证。确认通过？`))) return
    a.value = (await apiOnlineAccept(A.value.appId, comment.value, A.value.rewardMode==='per_item'?Number(qualifiedCount.value):undefined)).data
    toast('已验收通过，结算单已生成')
  } catch (e) { reviewError.value = errText(e, '验收失败，请重试'); toast(reviewError.value) }
  finally { reviewBusy.value = false }
}
// 截止后才退回：接单人只剩退回后的 48 小时（resubmitHours）重新提交，逾期就交不了、这单也没法再验收。退回前把后果说清楚
const returnLate = computed(() => !!A.value.deadlineTs && A.value.deadlineTs <= now.value)
const returnHint = computed(() => (returnLate.value
  ? `任务已过截止时间。退回后接单人还有 ${A.value.resubmitHours || 48} 小时可以重新提交，逾期没交这单就不能再验收；成果基本可用的话，建议直接验收通过。可以附截图说明要改的地方。`
  : '写清楚需要改哪里，可以附最多 9 张截图（在图上圈出来更直观）。接单人会收到消息，在任务交付页看到原因和截图后重新提交。'))
function reject() {
  if (!reviewAllowed()) return
  returnReason.value = comment.value
  returnImages.value = []
  returnNote.value = ''
  reviewError.value = ''
  editingReturn.value = false
  returnOpen.value = true
}
// 退回截图：和发素材一样一次多选、3 张一起传，选多了提示只加前几张，传不上的最后用红字说明是第几张
async function addReturnShots() {
  if (reviewBusy.value || returnUploading.value) return
  const left = MAX_SHOTS - returnImages.value.length
  if (left <= 0) return toast('最多附 ' + MAX_SHOTS + ' 张截图')
  const paths = takeRoom(await pickImages(left), left, '张')
  if (!paths.length) return
  returnUploading.value = true
  reviewError.value = ''
  returnNote.value = '正在上传 0/' + paths.length
  try {
    const r = await uploadAll(paths, uploadImage, (done, total) => { returnNote.value = '正在上传 ' + done + '/' + total })
    returnImages.value = returnImages.value.concat(r.urls).slice(0, MAX_SHOTS)
    returnNote.value = failedNote(r.failedAt, r.reason)
  } finally {
    returnUploading.value = false
  }
}
async function editReturnShot(i) {
  const k = await sheet(['查看大图', '移除这张'])
  if (k === 0) previewMaterial(returnImages.value, i)
  if (k === 1) returnImages.value = returnImages.value.filter((_, j) => j !== i)
}
// 退回接口在页面里直接调（带上截图），不改主包的 common/api.js
const apiReturnWithShots = (appId, reason, images) => post('/app/staff/online/assignments/' + appId + '/return', { reason, images })
async function submitReturn() {
  if (!reviewAllowed()) return
  if (returnUploading.value) { reviewError.value = '截图还在上传，请稍候'; return }
  const reason = returnReason.value.trim()
  const images = returnImages.value.slice()
  if (!reason && !images.length) { reviewError.value = '请写退回原因或附上截图'; return }
  if (reason.length > MAX_RETURN_TEXT) { reviewError.value = '退回说明不能超过 ' + MAX_RETURN_TEXT + ' 字（现在 ' + reason.length + ' 字），请删减一些；要改的地方多，可以在截图上圈出来'; return }
  reviewBusy.value = true
  reviewError.value = ''
  try {
    a.value = (await apiReturnWithShots(A.value.appId, reason, images)).data
    returnOpen.value = false
    reasonOpen.value = false
    const what = images.length ? '退回原因和截图' : '退回原因'
    toast(A.value.resubmitUntil ? `${what}发给接单人了，需在 ${A.value.resubmitUntil.slice(5)} 前重新提交` : `${what}发给接单人了，对方修改后会重新提交`)
    s.value = 3
  } catch (e) { reviewError.value = errText(e, '退回失败，请重试'); toast(reviewError.value) }
  finally { reviewBusy.value = false }
}
const settleBtnText = computed(() => {
  const st = A.value.settlement
  if (!st && A.value.reviewBlockReason) return '报名已结束 · 查看成果记录'
  if (!st) return latest.value && latest.value.status === 'submitted' ? (A.value.canReview ? '确认验收并生成结算单' : '待有验收权限的同事验收') : '等待对方提交成果'
  return { pending_payout: A.value.canPay ? '登记线下付款' : '待登记付款', payout_registered: '等待对方确认收款', confirmed: '结算完成', disputed: A.value.canCorrectPayout ? '核实并更正付款凭证' : '待核实并更正凭证' }[st.status] || st.statusLabel
})
const previewPayoutVoucher = () => uni.previewImage({ urls: [absUrl(A.value.settlement.voucher)] })
// ---------------- 登记付款（2026-11-03 主人：简化成一个底部面板） ----------------
// 之前：付款方式菜单 → 流水号输入框 → 「请上传凭证」提示 → 相册（更正时前面还有一个说明输入框、后面一个确认）= 4–6 个弹窗；
// 现在：一个面板里选方式、填流水号、点格子放凭证，一个「登记付款」按钮。更正争议凭证时面板顶上写明「这是更正」，提交前保留一次确认（涉及钱）
const payoutOpen = ref(false)
const payoutMethod = ref('')
const payoutRef = ref('')
const payoutVoucher = ref('')
const payoutNote = ref('')
const editingPayoutNote = ref(false)
const payoutError = ref('')
const voucherUploading = ref(false)
const payoutCorrecting = computed(() => A.value.settlement?.status === 'disputed')
// 服务端给的付款方式（专员拿到的是空列表，但专员本来就没有登记入口）；没给或给了空列表时用这几个默认的，按钮组不能是空的
const payoutMethods = computed(() => (Array.isArray(A.value.payoutMethods) && A.value.payoutMethods.length ? A.value.payoutMethods : ['银行转账', '微信转账', '支付宝转账', '现金', '其他']))
function onSettle() {
  if (payoutBusy.value) return
  const st = A.value.settlement
  if (!st) return pass()
  const correcting = st.status === 'disputed'
  if (st.status !== 'pending_payout' && !correcting) return toast(settleBtnText.value)
  if (!A.value.canPay) return toast('当前角色不能登记付款')
  if (correcting && !A.value.canCorrectPayout) return toast('当前角色不能更正争议付款凭证')
  // 更正时方式、流水号带上原来登记的，凭证要重新选一张
  payoutMethod.value = correcting && payoutMethods.value.includes(st.method) ? st.method : payoutMethods.value[0]
  payoutRef.value = correcting ? (st.ref || '') : ''
  payoutVoucher.value = ''
  payoutNote.value = ''
  editingPayoutNote.value = false
  payoutError.value = ''
  payoutOpen.value = true
}
// 点凭证格子：选一张就传，传好了格子里显示缩略图；再点可以换一张
async function pickVoucher() {
  if (payoutBusy.value || voucherUploading.value) return
  const path = await chooseImage()
  if (!path) return
  voucherUploading.value = true
  payoutError.value = ''
  try {
    payoutVoucher.value = await uploadImage(path)
  } catch (e) {
    payoutError.value = errText(e, '凭证上传失败，请重试')
  } finally {
    voucherUploading.value = false
  }
}
async function submitPayout() {
  if (payoutBusy.value) return
  if (voucherUploading.value) { payoutError.value = '凭证还在上传，请稍候'; return }
  const st = A.value.settlement
  if (!st) return
  const correcting = payoutCorrecting.value
  const note = payoutNote.value.trim()
  if (correcting && (!note || note.length > 200)) { payoutError.value = '请填写 1–200 字的核实与更正说明'; return }
  if (!payoutMethod.value) { payoutError.value = '请选一个付款方式'; return }
  if (payoutRef.value.trim().length > 64) { payoutError.value = '付款流水号不能超过 64 字'; return }
  if (!payoutVoucher.value) { payoutError.value = '请先点凭证格子，放一张付款截图或收据照片'; return }
  if (correcting && !(await confirm('确认更正付款凭证', `原结算金额 ${st.amount} 不变。此操作只登记更正记录，不会转账；提交后由接单人重新核对到账并确认。`))) return
  payoutBusy.value = true
  payoutError.value = ''
  try {
    a.value = (await apiOnlinePayout(A.value.appId, { method: payoutMethod.value, ref: payoutRef.value.trim(), voucher: payoutVoucher.value, correctionNote: note })).data
    payoutOpen.value = false
    toast(correcting ? '凭证已更正，等待对方重新确认收款' : '已登记线下付款，等待对方确认收款')
  } catch (e) {
    payoutError.value = errText(e, correcting ? '更正失败，请刷新后重试' : '登记失败')
    toast(payoutError.value)
  } finally { payoutBusy.value = false }
}
</script>

<style scoped lang="scss">
.application-count{display:inline-flex;align-items:center;min-height:44px;margin:0;padding:8px 10px;font-size:14px;line-height:1.5;color:var(--k-red);background:var(--k-paper);border:1px solid var(--k-line);border-radius:8px;text-align:left}.application-count::after{border:0}.application-count:focus-visible{outline:2px solid var(--k-red);outline-offset:2px}.task-card__foot{flex-wrap:wrap}.task-audit{margin-top:12px}.application-review{display:flex;flex-direction:column;gap:14px;margin:16px 0;padding:16px;background:var(--k-paper);border:1px solid var(--k-line);border-radius:12px}.application-review>view{display:flex;flex-direction:column;gap:8px}.application-review .k-meta{line-height:1.6}

/* 发布屏（s=1，2026-10-31 R7 改版）的样式在 ./form-clean.scss，和招募、创建活动、新增房源共用；publish-form.scss 这一包不删 */
@import './publish-form.scss';
@import './form-clean.scss';
.unavailable { opacity: .55; }
.review-state { display: block; padding: 12px 0; line-height: 1.6; }
.payment-evidence { display: flex; flex-direction: column; gap: 8px; padding: 12px; margin-top: 10px; border: 1px solid var(--k-line); border-radius: 10px; font-size: 13px; line-height: 1.6; overflow-wrap: anywhere; }
.contact-task { padding: 0 16px calc(72px + var(--k-safe-bottom)); }
/* 发素材（V37）：交付记录里的素材气泡与发送面板里的图片 */
.material-btn { margin-bottom: 10px; }
.material-bubble { max-width: 250px; white-space: pre-wrap; word-break: break-all; }
.material-photos { width: 234px; margin-top: 6px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.material-photos image { width: 100%; height: 72px; border-radius: 6px; }
.return-mask { position: fixed; inset: 0; z-index: 999; background: rgba(0,0,0,.4); display: flex; align-items: center; justify-content: center; padding: 20px; }
.return-panel { width: 100%; max-width: 420px; box-sizing: border-box; padding: 22px; border-radius: 16px; background: var(--k-paper); display: flex; flex-direction: column; gap: 12px; font-size: 14px; line-height: 1.6; }
.return-panel textarea, .return-panel .online-area-idle { box-sizing: border-box; width: 100%; height: 116px; padding: 10px; border: 1px solid #d6cfc5; border-radius: 8px; background: #fff; }
/* 没在输入时显示的预览：和输入框一样大，长文字换行、超出的部分藏起来 */
.return-panel .online-area-idle { overflow: hidden; white-space: pre-wrap; word-break: break-all; }
.return-actions { display: flex; gap: 12px; justify-content: flex-end; }
/* V41：弹窗不超过屏幕，图片 / 文件多了在中间这块里滚；按钮一直在底部 */
.return-panel { max-height: 88vh; }
.panel-hint { font-size: 13px; line-height: 1.6; }
.panel-scroll { flex: 0 1 auto; min-height: 60px; max-height: 30vh; }
.panel-scroll__body { display: flex; flex-direction: column; gap: 10px; }
.pick-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.pick-file { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border: 1px solid #d6cfc5; border-radius: 8px; background: #fff; font-size: 13px; }
.pick-file__name { flex: 1; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.upload-note { display: block; line-height: 1.5; }
/* 交付记录：退回原因保留换行；素材气泡里的文字和「展开全部」上下排；附件气泡里的长文件名省略 */
.review-text { display: block; white-space: pre-wrap; word-break: break-all; }
/* 写成 .bubble.material-bubble：后面那条 .bubble 的 align-items: center 会把短文字和「展开全部」挤到中间 */
.bubble.material-bubble { flex-direction: column; align-items: flex-start; gap: 4px; }
.file-info { flex: 1; min-width: 0; }
.file-name { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
/* 2026-11-03 主人：简化 —— 发布屏底栏上面一行「还差什么 / 可以提交」（和招募表同一种写法）；这一行可能折两行，表单底部多留 20 */
.fc-bar__todo { display: flex; align-items: center; justify-content: center; min-height: 44px; margin-top: -8px; padding: 0 4px; font-size: 14px; line-height: 20px; text-align: center; color: var(--k-red-deep); }
.fc-bar__todo--err { color: var(--k-alert); }
.fc-bar__todo--ok { color: var(--k-muted); }
.fc-form { padding-bottom: calc(128px + var(--k-safe-bottom)); }
/* 2026-11-03 主人：简化 —— 第 2 屏的任务列表（一张卡一条任务，写报名 / 待验收）、详情顶上的「全部任务」、接单人一人一行。字不小于 14、能点的不低于 44 */
.list-hint { display: block; margin-bottom: 10px; font-size: 14px; line-height: 1.6; color: var(--k-muted); }
.list-state { min-height: 160px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; color: var(--k-muted); font-size: 15px; }
.task-card { margin-top: 10px; padding: 14px; border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-paper); display: flex; flex-direction: column; gap: 10px; }
.task-card__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
.task-card__title { flex: 1; min-width: 0; font-family: var(--k-serif); font-size: 17px; font-weight: 700; line-height: 1.4; overflow-wrap: anywhere; }
.task-card__foot { display: flex; align-items: center; gap: 14px; font-size: 14px; line-height: 20px; color: var(--k-ink); }
.all-tasks { display: flex; align-items: center; gap: 2px; min-height: 44px; margin: -6px 0 2px; font-size: 15px; color: var(--k-ink); }
.people { margin-top: 9px; padding: 11px; border: 1px solid var(--k-line); border-radius: 10px; background: var(--k-paper); }
.people .k-link { font-size: 14px; padding: 6px 0; }
.people__empty { display: block; padding: 14px 0 6px; font-size: 14px; line-height: 1.6; color: var(--k-muted); }
.person { display: flex; align-items: center; gap: 8px; min-height: 56px; padding: 8px 0; }
/* 行与行之间一条线：写成 .person + .person（.people 里第一个 view 是标题行，:first-of-type 对不上第一个人） */
.person + .person { border-top: 1px solid var(--k-line); }
.person__copy { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.person__name { font-size: 16px; font-weight: 600; line-height: 1.4; }
.person__meta { font-size: 13px; line-height: 1.5; color: var(--k-muted); overflow-wrap: anywhere; }
/* 继续开启：新时间一行（字 + 滚轮按钮），按钮样式 fc-pick 来自 form-clean.scss */
.reopen-when { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
.reopen-when__k { font-size: 14px; color: var(--k-ink); }
/* 登记付款面板：整个面板是 scroll-view，内容在 pay-panel__body 里；按钮组、输入框、凭证格都不低于 44 */
.pay-panel { padding: 0; display: block; }
.pay-panel__body { box-sizing: border-box; padding: 22px; display: flex; flex-direction: column; gap: 12px; font-size: 14px; line-height: 1.6; }
.pay-field { display: flex; flex-direction: column; gap: 8px; }
.pay-field__k { font-family: var(--k-serif); font-size: 15px; font-weight: 700; }
.pay-field__k .k-meta, .pay-field__k .k-alert { font-family: var(--k-sans); font-size: 13px; font-weight: 400; }
.pay-methods { display: flex; flex-wrap: wrap; gap: 8px; }
.pay-methods__btn { min-height: 44px; padding: 0 16px; box-sizing: border-box; border: 1px solid var(--k-line); border-radius: 12px; background: #fff; display: flex; align-items: center; font-size: 15px; color: var(--k-ink); }
.pay-methods__btn.on { border-color: var(--k-red-deep); background: var(--k-red-deep); color: var(--k-paper); }
.pay-input { box-sizing: border-box; width: 100%; height: 44px; padding: 0 10px; border: 1px solid #d6cfc5; border-radius: 8px; background: #fff; font-size: 15px; }
.return-panel .pay-note { height: 88px; }
.pay-voucher { width: 100%; height: 120px; box-sizing: border-box; border: 1px dashed #d6cfc5; border-radius: 8px; background: #fff; overflow: hidden; display: flex; align-items: center; justify-content: center; }
.pay-voucher image { width: 100%; height: 100%; }
.pay-voucher__empty { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 0 12px; font-size: 14px; color: var(--k-muted); text-align: center; }

.section-title{font-family:var(--k-serif);font-size:16px;font-weight:700}.field-label{width:78px;display:flex;align-items:center;gap:7px;font-family:var(--k-serif);font-size:15px;font-weight:700}.field-label text:first-child{color:var(--k-red)}.field-box{height:38px;min-width:0;flex:1;padding:0 10px;border:1px solid var(--k-line);border-radius:8px;background:var(--k-paper);display:flex;align-items:center;justify-content:space-between;font-size:13px}.field-value{min-width:0;flex:1}.field-text{min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.title-field .field-label{margin-bottom:7px}.title-field .field-box{width:100%;box-sizing:border-box}.form-row{display:flex;align-items:center;margin-top:10px}.ai-head{display:flex;align-items:center;justify-content:space-between;margin:14px 3px 7px;font-family:var(--k-serif);font-size:15px;font-weight:700}.ai-card{padding:10px;border:1px solid var(--k-line);border-radius:9px;background:var(--k-paper)}.ai-card__prompt{display:block;font-size:12px;line-height:1.6}.generate{width:85px;height:28px;margin:7px 0 8px auto;border:1px solid var(--k-red-line);border-radius:7px;display:flex;align-items:center;justify-content:center;gap:4px;color:var(--k-red);font-size:12px}.ai-result{padding:9px;border:1px solid var(--k-line);border-radius:7px;font-size:12px;line-height:1.65}.ai-result text{display:block}.ai-result text:last-child{text-align:right;color:var(--k-muted)}.publish-btn{margin-top:55px}
.hero{border:1px solid var(--k-line);border-radius:10px;background:var(--k-paper);overflow:hidden}.hero>image{width:100%;height:116px}.hero__title{height:38px;padding:0 10px;display:flex;align-items:center;justify-content:space-between;gap:8px;font-family:var(--k-serif);font-size:16px;font-weight:700}.detail-card,.match-card,.requirements{margin-top:9px;padding:11px;border:1px solid var(--k-line);border-radius:10px;background:var(--k-paper)}.detail-card__desc{display:block;margin-top:7px;font-size:12px;line-height:1.6}.detail-stats{display:grid;grid-template-columns:repeat(3,1fr);margin-top:10px;padding-top:9px;border-top:1px solid var(--k-line)}.detail-stats>view{border-left:1px solid var(--k-line);text-align:center}.detail-stats>view:first-child{border-left:0}.detail-stats text{display:block;font-size:11px}.detail-stats text:last-child{margin-top:7px;font-family:var(--k-sans);font-size:16px}.match-card__rate{display:block;margin-top:9px;font-size:13px}.match-card__rate text{font-size:18px}.match-chips{display:flex;gap:9px;margin-top:9px}.requirements text{display:block;margin-top:8px;font-size:12px}.reopen-card{margin-top:9px;padding:11px;border:1px solid var(--k-line);border-radius:10px;background:var(--k-paper);display:flex;flex-direction:column;gap:9px;font-size:13px;line-height:1.6;color:var(--k-ink)}.apply-bar{margin-top:9px;padding:10px;border:1px solid var(--k-line);border-radius:10px;background:var(--k-paper)}.apply-bar .k-button{margin-top:9px}
.announcement{padding:10px 12px;border:1px solid var(--k-line);border-radius:9px;background:var(--k-paper)}.announcement>text{display:block;margin-top:6px;font-size:11px;line-height:1.45}.system-msg{display:block;margin:10px 0;text-align:center;color:var(--k-muted);font-size:12px}.chat{display:flex;gap:7px;margin-top:8px}.chat>image{width:32px;height:32px;border-radius:50%}.chat__name{display:block;color:var(--k-muted);font-size:10px}.file-bubble,.bubble{margin-top:4px;padding:8px;border:1px solid var(--k-line);border-radius:8px;background:var(--k-paper);display:flex;align-items:center;gap:9px}.file-bubble{width:250px}.file-icon{width:35px;height:40px;border-radius:5px;background:#507DB5;display:flex;align-items:center;justify-content:center}.file-bubble text{display:block;font-size:12px}.file-bubble text:last-child{margin-top:4px;color:var(--k-muted);font-size:10px}.bubble{font-size:12px}.right{justify-content:flex-end}.right .chat__name{text-align:right}.bubble--mine{background:var(--k-green-soft)}.submit-card{margin-top:9px;padding:10px;border:1px solid var(--k-line);border-radius:9px;background:var(--k-paper)}.submit-card__label{display:block;margin-top:7px;font-size:11px}.url,.supplement{height:30px;margin-top:5px;padding:0 8px;border:1px solid var(--k-line);border-radius:6px;display:flex;align-items:center;justify-content:space-between;gap:8px;color:var(--k-muted);font-size:11px}.url__copy{flex-shrink:0;color:var(--k-red)}.supplement{height:auto;min-height:30px;padding:6px 8px;white-space:pre-wrap;word-break:break-all}.photos{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:7px}.photos image{width:100%;height:72px;border-radius:6px}.deadline{margin-top:8px;padding:7px 9px;border:1px solid var(--k-line);border-radius:9px;background:var(--k-paper);display:flex;align-items:center;justify-content:space-between;color:var(--k-red);font-size:13px;font-weight:700}.deadline.is-over{color:var(--k-alert)}.deadline .k-button{width:155px}
.result-card,.inspection,.payment{padding:11px;border:1px solid var(--k-line);border-radius:10px;background:var(--k-paper)}.result-card__body{margin-top:8px;padding:6px;border:1px solid var(--k-line);border-radius:8px;display:flex;align-items:center;gap:10px}.result-card__body image{width:72px;height:72px;border-radius:6px}.result-card__body text{display:block;margin-top:7px;font-size:11px}.inspection,.payment{margin-top:10px}.decision{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:8px}.decision>view{height:44px;border:1px solid var(--k-line);border-radius:8px;display:flex;align-items:center;justify-content:center;gap:7px;font-family:var(--k-serif);font-size:16px;font-weight:700}.decision__pass{color:white;background:var(--k-green)}.decision__return{color:var(--k-red)}.field-title{display:block;margin-top:10px;font-family:var(--k-serif);font-size:14px;font-weight:700}.comment{min-height:42px;margin-top:6px;padding:8px;border:1px solid var(--k-line);border-radius:7px;font-size:11px}.comment text{display:block}.comment text:last-child{text-align:right;color:var(--k-muted)}.pay-row{height:37px;margin-top:8px;padding:0 9px;border:1px solid var(--k-line);border-radius:7px;display:flex;align-items:center;justify-content:space-between}.pay-row text:last-child{color:var(--k-red);font-family:var(--k-sans);font-size:20px}.pay-method{margin:6px 0 9px;padding:8px;border:1px solid var(--k-line);border-radius:7px;display:flex;align-items:center;gap:7px}.pay-check{width:17px;height:17px;border-radius:50%;background:var(--k-red);display:flex;align-items:center;justify-content:center}.pay-method text{display:block;font-size:11px}.pay-method text:last-child{margin-top:3px;color:var(--k-muted);font-size:9px}.paid{height:55px;margin-top:9px;padding:0 12px;border:1px solid var(--k-line);border-radius:10px;background:var(--k-paper);display:flex;align-items:center;gap:10px}.paid__check{width:36px;height:36px;border-radius:50%;background:var(--k-green);display:flex;align-items:center;justify-content:center}.paid text{display:block}.paid>text{color:var(--k-green);font-family:var(--k-sans);font-size:22px}.paid .k-flex1 text:first-child{font-family:var(--k-serif);font-size:15px;font-weight:700}.paid .k-flex1 text:last-child{margin-top:4px;color:var(--k-muted);font-size:10px}.pay-notice{height:54px;margin-top:9px;padding:0 11px;border:1px solid var(--k-line);border-radius:10px;background:var(--k-paper);display:flex;align-items:center;gap:9px}.notice-icon{width:29px;height:29px;border-radius:50%;background:#5FA67E;display:flex;align-items:center;justify-content:center}.pay-notice text{display:block;font-size:11px}.pay-notice .k-flex1 text:first-child{font-family:var(--k-serif);font-size:14px;font-weight:700}.pay-notice .k-flex1 text:last-child{margin-top:4px;color:var(--k-muted)}
.detail-page .detail-card,.detail-page .match-card,.detail-page .requirements{padding:9px}.detail-page .detail-card__desc{margin-top:5px;line-height:1.45}.detail-page .detail-stats{margin-top:6px;padding-top:6px}.detail-page .detail-stats>view:last-child text:last-child{font-size:12px;white-space:nowrap}.detail-page .match-card__rate,.detail-page .match-chips{margin-top:6px}.detail-page .requirements text{margin-top:6px}.detail-page .apply-bar{margin-top:7px;padding:8px}.detail-page .apply-bar .k-button{margin-top:7px}
.group-page .announcement{padding:8px 10px}.group-page .announcement>text{margin-top:4px;font-size:10px}.group-page .system-msg{margin:7px 0}.group-page .chat{margin-top:5px}.group-page .submit-card{margin-top:6px;padding:8px}.group-page .submit-card__label{margin-top:4px}.group-page .url{height:27px;margin-top:4px}.group-page .supplement{min-height:27px;margin-top:4px}.group-page .photos{margin-top:5px}.group-page .photos image{height:64px}.group-page .deadline{margin-top:6px;padding-top:5px;padding-bottom:5px}
.inspect-page .result-card,.inspect-page .inspection,.inspect-page .payment{padding:8px}.inspect-page .result-card__body{margin-top:6px}.inspect-page .result-card__body image{width:66px;height:66px}.inspect-page .inspection,.inspect-page .payment{margin-top:7px}.inspect-page .decision{margin-top:6px}.inspect-page .decision>view{height:40px}.inspect-page .field-title{margin-top:7px}.inspect-page .comment{min-height:36px;margin-top:4px;padding:6px}.inspect-page .pay-row{height:33px;margin-top:6px}.inspect-page .pay-method{margin:4px 0 6px;padding:6px}.inspect-page .paid,.inspect-page .pay-notice{margin-top:6px}
/* 成果链接（V47 起可以是整段分享口令）：全文原样显示、自动换行，网址标红可点（点了复制） */
.url.url--text,.group-page .url.url--text{height:auto;min-height:27px;padding:6px 8px;display:block;color:var(--k-ink);line-height:1.6;white-space:pre-wrap;word-break:break-all}.url__link,.result-card__body .result-link__url{color:var(--k-red);text-decoration:underline}.url-acts{display:flex;gap:12px;margin-top:7px;font-size:11px}.result-card__body>view{flex:1;min-width:0}.result-card__body image{flex-shrink:0}.result-link{margin-top:7px;font-size:11px;line-height:1.6;white-space:pre-wrap;word-break:break-all}.result-card__body .result-link text{display:inline;margin-top:0}.result-link__acts{display:flex;gap:14px}.link-block+.link-block{margin-top:4px}.result-card__body .result-link__label{margin-top:7px;color:var(--k-muted);font-weight:700}.result-link-item+.result-link-item{margin-top:2px}.result-card__body .result-link__acts text{color:var(--k-red)}
.deadline-inputs{display:flex;gap:12px;margin-top:12px;align-items:center}.deadline-date,.deadline-clock{display:flex;align-items:center;justify-content:space-between;gap:8px;box-sizing:border-box;background:var(--k-paper2);border:1px solid var(--k-line2);border-radius:10px;padding:12px;font-size:15px;line-height:24px;white-space:nowrap;color:var(--k-ink);margin:0}.deadline-date{flex:1;min-width:0}.deadline-date:after{border:0}.deadline-inputs picker{flex:0 0 104px}.account-requirements .fc-label{margin-bottom:10px}
.fc-quota-input { width: 54px; height: 44px; text-align: center; border: 1px solid var(--k-line); border-radius: 8px; background: var(--k-paper); }
</style>
