<template>
  <k-community-gate>
  <view class="k-page publish-page">
    <template v-if="s === 1">
      <!-- 2026-10-17 发布页改版（对照主人样稿 图 3）：顶栏「‹ 发布内容」+ 右上「草稿箱」；三个大胶囊选类型；白色大卡放图片 / 标题 / 正文；
           「关联帖子」「补充信息」两张可展开的卡；底部固定「存草稿 / 发布」。底部导航在这一屏不放（和底部操作条叠在一起太挤，左上角能返回） -->
      <k-topbar :title="type" back />
      <view class="publish-body">
        <!-- 草稿箱：本机只存一份草稿，有草稿时带个 1；点开看标题 / 类型 / 保存时间，继续编辑或删除。
             2026-10-17 主人真机截图：放在顶栏右边时，小程序右上角有系统胶囊，草稿箱被挤到中间压住「发布内容」标题 —— 挪到正文第一行右边 -->
        <view class="pub-tools"><view class="drafts" hover-class="k-press" @click="openDraft"><k-icon name="file-pen" :size="14" color="red" :stroke="1.9" /><text>草稿箱</text><text v-if="draftCount" class="drafts__num">{{draftCount}}</text></view></view>
        <!-- 恢复了草稿：表单顶部一条提示，写明是哪次存的，可以一键清空 -->
        <view v-if="restoredAt" class="draft-bar"><k-icon name="file-pen" :size="15" color="ochre" :stroke="1.8" /><text class="draft-bar__text">{{ restoredText }}</text><view class="draft-bar__clear" hover-class="k-press" @click="clearDraft"><text>清空</text></view></view>
        <!-- 类型：三个大胶囊，选中是暖棕渐变白字 -->
        <view class="type-pills">
          <view v-for="item in types" :key="item.name" class="type-pill" :class="{ active: type === item.name }" hover-class="k-press-s" @click="pickType(item.name)"><text>{{ item.name }}</text></view>
        </view>
        <!-- 选了「经验分享」就先查可关联的经历：之前写完正文点「下一步」才发现没有经历、发不了 -->
        <template v-if="type === '经验分享'">
          <!-- 经历类型（样稿里的一行胶囊）：只是预选，到「经历校验」时把这一类的经历排在前面、先选上一段；真正发的还是你选的那一段报名 -->
          <view class="exp-types"><text class="exp-types__label">选择经历类型</text><view class="exp-types__pills"><view v-for="j in EXP_TYPES" :key="j.key" class="exp-type-pill" :class="{ on: expType === j.key }" hover-class="k-press" @click="pickExpType(j.key)"><text>{{ j.label }}</text></view></view></view>
          <view v-if="expFailed" class="exp-hint" hover-class="k-press" @click="loadExperiences"><view class="exp-hint__row"><k-icon name="refresh-cw" :size="15" color="muted" :stroke="1.8" /><text class="exp-hint__text">经历没加载出来，点这里重试</text></view></view>
          <view v-else-if="expLoaded && experiences.length" class="exp-hint exp-hint--ok"><view class="exp-hint__row"><k-icon name="circle-check" :size="15" color="green" :stroke="1.8" /><text class="exp-hint__text">有 {{ experiences.length }} 段经历可以关联，写好后点「下一步」选择</text></view></view>
          <view v-else-if="expLoaded" class="exp-hint exp-hint--warn">
            <view class="exp-hint__row"><k-icon name="info" :size="16" color="ochre" :stroke="1.8" /><text class="exp-hint__title">还没有可以用来分享的岗位经历</text></view>
            <text class="exp-hint__sub">{{ expHintSub }}</text>
            <text class="exp-hint__sub">简历里自己填写的经历、活动报名不能作为经验分享的依据</text>
            <view class="exp-hint__links"><view v-if="expOff.length" class="exp-hint__link" hover-class="k-press" @click="s = 3"><text>查看原因</text><k-icon name="chevron-right" :size="14" color="red" /></view><view class="exp-hint__link" hover-class="k-press" @click="goJobs"><text>去找机会</text><k-icon name="chevron-right" :size="14" color="red" /></view></view>
          </view>
        </template>

        <!-- 白色大卡：图片（第一张是封面）/ 标题 / 正文 -->
        <view class="compose">
          <!-- 2026-10-18 按主人两张发布页样稿，图片区按类型换样子（传的还是同一份 uploads，第一张是封面）：
               经验分享 = 照片九宫格（第一格大「添加经历照片」，其余小格）；旅居日常 = 16:9 大封面；找搭子 = 原来的虚线框 -->
          <view v-if="type === '经验分享'" class="exp-grid" :class="{ 'exp-grid--filled': uploads.length > 1 }">
            <view v-if="!uploads.length" class="exp-grid__big exp-grid__add" hover-class="k-press" @click="addImages">
              <view class="media-empty__icon"><k-icon name="image-plus" :size="26" color="red" :stroke="1.7" /></view>
              <text class="media-empty__title">添加经历照片</text><text class="media-empty__sub">最多 9 张</text>
            </view>
            <view v-else class="exp-grid__big">
              <image class="exp-grid__img" :src="uploads[0].img" mode="aspectFill" />
              <text class="cover__tag">封面</text>
              <view class="upload-close cover__close" hover-class="k-press" @click="removeUpload(0)"><k-icon name="x" :size="13" color="white" :stroke="2.2" /></view>
              <view class="cover__pen exp-grid__pen" hover-class="k-press-s" @click="replaceCover"><k-icon name="pencil" :size="15" color="white" :stroke="2" /></view>
            </view>
            <view v-for="(item, upIdx) in uploads.slice(1)" :key="item.url || item.img" class="exp-grid__cell">
              <image class="exp-grid__img" :src="item.img" mode="aspectFill" />
              <view class="upload-close" hover-class="k-press" @click="removeUpload(upIdx + 1)"><k-icon name="x" :size="13" color="white" :stroke="2.2" /></view>
            </view>
            <view v-if="uploads.length < 9" class="exp-grid__cell exp-grid__plus" hover-class="k-press" @click="addImages"><k-icon name="plus" :size="24" color="red" :stroke="2" /></view>
            <!-- 只有 0–1 张时右边第二格空着难看：放一格「已传 n/9」，点了也是加照片 -->
            <view v-if="uploads.length < 2" class="exp-grid__cell exp-grid__count" hover-class="k-press" @click="addImages"><k-icon name="images" :size="20" color="muted" :stroke="1.7" /><text>{{ uploads.length }}/9</text></view>
          </view>
          <!-- 旅居日常还没有图：16:9 大封面占位，右下暖棕铅笔圆钮 -->
          <view v-else-if="type === '旅居日常' && !uploads.length" class="cover cover--empty" hover-class="k-press" @click="addImages">
            <view class="cover__hint"><k-icon name="image-plus" :size="30" color="red" :stroke="1.6" /><text class="cover__hint-title">添加封面</text><text class="cover__hint-sub">最多 9 张图片，第一张是封面</text></view>
            <view class="cover__pen cover__pen--corner"><k-icon name="pencil" :size="16" color="white" :stroke="2" /></view>
          </view>
          <view v-else-if="!uploads.length" class="media-empty" hover-class="k-press" @click="addImages">
            <view class="media-empty__icon"><k-icon name="image-plus" :size="26" color="red" :stroke="1.7" /></view>
            <text class="media-empty__title">添加照片</text><text class="media-empty__sub">最多 9 张，第一张是封面</text>
          </view>
          <template v-else>
            <view class="cover">
              <image class="cover__img" :src="uploads[0].img" mode="aspectFill" />
              <view class="cover__shade" />
              <text class="cover__tag">封面</text>
              <view class="upload-close cover__close" hover-class="k-press" @click="removeUpload(0)"><k-icon name="x" :size="13" color="white" :stroke="2.2" /></view>
              <!-- 底部一条：左「更换封面 / 最多 9 张图片」，右下暖棕铅笔圆钮；整条都能点，换一张封面（只换第一张，其余不动） -->
              <view class="cover__edit" hover-class="k-press-s" @click="replaceCover"><view class="cover__edit-copy"><text>更换封面</text><text class="cover__edit-sub">最多 9 张图片 · 已传 {{ uploads.length }} 张</text></view><view class="cover__pen"><k-icon name="pencil" :size="16" color="white" :stroke="2" /></view></view>
            </view>
            <!-- 之前不换行：传到第 4 张后「+」被挤出屏幕；现在其余的图每行 4 个自动换行，最后一格是「+」 -->
            <view class="uploads">
              <view v-for="(item, upIdx) in uploads.slice(1)" :key="item.url || item.img" class="upload-item">
                <image class="upload-img" :src="item.img" mode="aspectFill" />
                <view class="upload-close" hover-class="k-press" @click="removeUpload(upIdx + 1)"><k-icon name="x" :size="13" color="white" :stroke="2.2" /></view>
                <text v-if="item.duration" class="upload-duration">{{ item.duration }}</text>
              </view>
              <view v-if="uploads.length < 9" class="upload-add" hover-class="k-press" @click="addImages"><k-icon name="plus" :size="24" color="red" :stroke="2.2" /></view>
            </view>
          </template>
          <view class="field-block"><view class="field-head"><text class="field-label">标题</text><text class="counter">{{ title.length }}/60</text></view><view class="text-field"><input v-model="title" maxlength="60" :placeholder="typeInfo.titlePh" placeholder-class="publish-ph" /></view></view>
          <view class="compose__line" />
          <!-- 微信里 textarea 是原生层、永远盖在最上面：滚到底部操作条下面时点按钮会点进输入框；不打字时换成长得一样的 view -->
          <view class="field-block body-field-block"><view class="field-head"><text class="field-label">正文</text><text class="counter">{{ body.length }}/500</text></view><view class="textarea-field"><textarea v-if="editingBody" v-model="body" maxlength="500" :focus="true" auto-focus :placeholder="typeInfo.bodyPh" placeholder-class="publish-ph" @blur="body = $event.detail.value; editingBody = false" /><view v-else class="publish-area-idle" @click="editingBody = true"><text :class="{ 'publish-area-ph': !body }">{{ body || typeInfo.bodyPh }}</text></view></view></view>
        </view>

        <!-- 关联帖子（选填）：找搭子 / 旅居日常 / 经验分享都可以关联一个 小院 / 门店、岗位 或 活动，帖子里显示「关联：XXX」，点了直接打开；
             2026-10-17 r2：经验分享也能自己选了（之前固定关联「经历校验」那段报名的岗位、这里不能点）；不选时照旧自动关联那个岗位，卡上写明 -->
        <view class="fold link-card" hover-class="k-press-s" @click="pickLink">
          <view class="fold__head">
            <view class="fold__icon"><k-icon name="link" :size="16" color="red" :stroke="1.9" /></view>
            <view class="fold__copy"><text class="fold__title">关联帖子<text class="fold__opt">（选填）</text></text><text v-if="!link0" class="fold__sub">{{ linkSub }}</text></view>
            <text class="fold__action">{{ link0 ? '更换' : '选择' }}</text><k-icon name="chevron-right" :size="16" color="muted" />
          </view>
          <!-- 已关联：白色小卡（封面、标题、类型标签、右边「已关联 / 不关联」），分隔线下一行说明（样稿写的「内容会归入该帖子下展示」现在没有这个功能，照实写） -->
          <view v-if="link0" class="link-pick">
            <view class="link-pick__row">
              <image v-if="link0.cover" class="link-pick__img" :src="absUrl(link0.cover)" mode="aspectFill" />
              <view v-else class="link-pick__img link-pick__img--empty"><k-icon :name="linkIcon(link0.type)" :size="20" color="red" :stroke="1.7" /></view>
              <view class="link-pick__copy"><text class="link-pick__title">{{ link0.title }}</text><view class="link-pick__tags"><text class="link-tag">{{ link0.label }}</text><text v-if="link0.city" class="link-pick__city">{{ link0.city }}</text></view></view>
              <view class="link-pick__side"><text class="link-pick__on">已关联</text><view class="link-pick__x" hover-class="k-press" hover-stop-propagation @click.stop="clearLink"><text>不关联</text></view></view>
            </view>
            <text class="link-pick__note">发布后，读者可从你的帖子打开这个{{ link0.label }}</text>
          </view>
        </view>

        <!-- 补充信息（选填）：城市 / 日期 / 找搭子的同行性别 / 旅居日常的伙伴说，收起时显示已选信息 -->
        <view class="fold extra">
          <view class="fold__head" hover-class="k-press" @click="extraOpen = !extraOpen">
            <view class="fold__icon"><k-icon name="sliders-horizontal" :size="16" color="red" :stroke="1.9" /></view>
            <view class="fold__copy"><text class="fold__title">补充信息<text class="fold__opt">（选填）</text></text><text class="fold__sub">{{ extraOpen ? typeInfo.extraSub : extraSummary }}</text></view>
            <k-icon :name="extraOpen ? 'chevron-up' : 'chevron-down'" :size="18" color="muted" />
          </view>
          <view v-if="extraOpen" class="fold__body">
            <view class="publish-row" hover-class="k-press" @click="pickCity"><text>城市</text><view class="publish-row__right"><text>{{ city }}</text><k-icon name="map-pin" :size="18" color="muted" :stroke="1.6" /></view></view>
            <view class="publish-row" hover-class="k-press" @click="pickDate"><text>日期</text><view class="publish-row__right"><text>{{ dateLabel }}</text><k-icon name="calendar" :size="18" color="muted" /></view></view>
            <view v-if="type === '找搭子'" class="publish-opt"><view class="publish-opt__head"><text>同行性别</text></view><view class="opt-pills"><view v-for="g in GENDER_LIMITS" :key="g.key" class="opt-pill" :class="{ on: genderLimit === g.key }" hover-class="k-press-s" @click="genderLimit = g.key"><text>{{ g.label }}</text></view></view></view>
            <!-- 旅居日常的「伙伴说」：推荐 / 避雷，可不选；发出去后卡片和详情上显示一个小标签 -->
            <view v-if="type === '旅居日常'" class="publish-opt"><view class="publish-opt__head"><text>伙伴说</text><text class="optional">（可选）</text></view><view class="opt-pills"><view v-for="t in TONES" :key="t.key" class="opt-pill" :class="{ on: tone === t.key }" hover-class="k-press-s" @click="tone = t.key"><text>{{ t.label }}</text></view></view></view>
          </view>
        </view>
        <view class="publish-history"><text class="publish-history__hint">查看已提交的内容和审核进度</text><button hover-class="k-press" @click="go(R.myPosts)">我的发布<k-icon name="chevron-right" :size="16" color="red" /></button></view>
      </view>
      <!-- 底部固定条：存草稿（描边）/ 发布（暖棕渐变）。找搭子还要验证手机、同步活动，经验分享还要选经历，按钮写「下一步」 -->
      <view class="pbar">
        <view class="pbar__row">
          <view class="pbar__draft" hover-class="k-press" @click="saveDraft"><text>存草稿</text></view>
          <view class="pbar__go" :class="{ 'is-busy': submitting }" :aria-disabled="submitting" hover-class="k-press-s" @click="next"><text>{{ nextLabel }}</text></view>
        </view>
        <view class="pbar__safe" />
      </view>
    </template>

    <template v-else-if="s === 2">
      <k-topbar title="手机验证" back custom-back @back="leavePhone" />
      <view class="verify-body k-pad-tab">
        <view class="verify-art"><view class="verify-art__phone"><k-icon name="smartphone" :size="48" color="red" :stroke="1.6" /><view class="verify-art__badge"><k-icon name="check" :size="17" color="white" :stroke="2.4" /></view></view></view>
        <text class="verify-lead">为保障发布安全与沟通顺畅</text><text class="verify-title">发布“找搭子”内容前需验证手机号</text>
        <view class="verify-info">
          <view class="verify-info__row"><k-icon name="info" :size="18" color="ochre" :stroke="1.7" /><view><text class="verify-info__title">用途说明：</text><text class="verify-info__text">用于身份验证、联系沟通与活动通知，\n不会用于其他用途。</text></view></view>
          <view class="verify-info__row"><k-icon name="shield-check" :size="18" color="ochre" :stroke="1.7" /><view><text class="verify-info__title">隐私保护：</text><text class="verify-info__text">你的手机号仅对你和相关参与者可见，\n我们将严格保护你的隐私。</text></view></view>
        </view>
        <view class="phone-wrap"><text class="phone-label">手机号</text><view class="phone-field"><text class="phone-number">{{ phoneText }}</text><view class="phone-authorize"><text>手机号授权</text><k-icon name="phone" :size="23" color="green" :stroke="1.7" /></view></view><text class="change-account" @click="changeAccount">更换手机号</text></view>
        <k-button size="lg" block open-type="getPhoneNumber" @getphonenumber="onPhone" @click="onPhoneClick">授权并验证</k-button><text class="verify-foot">验证通过后将自动返回草稿</text>
      </view>
      <k-tabbar active="publish" />
    </template>

    <template v-else-if="s === 3">
      <k-topbar title="经历校验" back custom-back @back="s = 1" />
      <view class="experience-body k-pad-tab">
        <!-- 2026-10-16：「换工日记」改名「经验分享」，换宿、兼职、全职的经历都能发（服务端 experiences 的口径）；
             反馈 2.0：已到岗还没做完的也算（和简历「平台记录」一致），暂时不能用的报名灰着列出来、写明原因 -->
        <view class="experience-tip"><view><text class="experience-tip__title">发布“经验分享”需关联一段岗位经历</text><text class="experience-tip__sub">已到岗或已完成的换宿、兼职、全职都可以</text></view><k-icon name="clipboard-check" :size="34" color="ochre" :stroke="1.4" /></view>
        <view class="experience-head"><text class="section-title">选择经历</text><view class="k-row k-gap4" hover-class="k-press" @click="goJobs"><text class="experience-link">去找机会</text><k-icon name="chevron-right" :size="15" color="muted" /></view></view>
        <!-- 之前按标题选，同一个岗位做过两次会两条一起选中；现在按报名编号选 -->
        <view v-for="item in experiences" :key="item.appId" class="experience-card" hover-class="k-press-s" @click="selected = item.appId">
          <image class="experience-img" :src="item.img" mode="aspectFill" />
          <!-- 之前标题和两个小标签挤一行，320 宽标题只剩三四个字；现在标题最多两行，类型 / 已完成（进行中）另起一行，没填服务内容就不显示「服务：」 -->
          <view class="experience-copy"><text class="experience-name">{{ item.title }}</text><view class="experience-tags"><text v-if="item.jobTypeLabel" class="exp-type">{{ item.jobTypeLabel }}</text><text class="done" :class="{ 'done--ongoing': item.ongoing }">{{ item.stateText }}</text></view><text v-if="item.service" class="experience-meta">服务：{{ item.service }}</text><text class="experience-meta experience-date">{{ item.dateLabel }}：{{ item.date }}</text></view>
          <view class="radio" :class="{ selected: selected === item.appId }"><view v-if="selected === item.appId" class="radio__dot" /></view>
        </view>
        <view v-if="expLoaded && !experiences.length" class="empty-experience"><text class="empty-experience__title">还没有可用的岗位经历</text><text class="empty-experience__sub">换宿、兼职、全职到岗后，就可以分享你的经历</text><k-button type="outline" size="sm" @click="goJobs">去寻找机会</k-button></view>
        <!-- 暂时还不能用的报名：灰着显示、不能选，写明原因（服务端 unavailable；老接口没有这一项就不显示） -->
        <template v-if="expOff.length">
          <text class="experience-off-head">暂时还不能用</text>
          <view v-for="item in expOff" :key="item.key" class="experience-card experience-card--off">
            <view class="experience-off-icon"><k-icon name="lock" :size="18" color="light" :stroke="1.7" /></view>
            <view class="experience-copy"><text class="experience-name">{{ item.title }}</text><view v-if="item.jobTypeLabel" class="experience-tags"><text class="exp-type">{{ item.jobTypeLabel }}</text></view><text class="experience-reason">{{ item.reason }}</text></view>
          </view>
        </template>
        <view class="experience-rule"><k-icon name="info" :size="14" color="muted" :stroke="1.8" /><text>简历里自己填写的经历、活动报名不能作为经验分享的依据</text></view>
        <k-button size="lg" block :disabled="!selected" @click="submitDiary">发布</k-button>
      </view>
      <k-tabbar active="publish" />
    </template>

    <template v-else>
      <k-topbar title="同步活动板" back custom-back @back="s = 1" />
      <view class="sync-body k-pad-tab">
        <view class="sync-switch-row"><view><text class="sync-switch-title">同步为用户自发活动</text><text class="sync-switch-sub">开启后将同步到“活动”频道，更多人可见</text></view><view class="switch" :class="{ on: syncOn }" @click="syncOn = !syncOn"><view class="switch__knob" /></view></view>
        <view class="activity-title-row"><text class="section-title">活动信息</text><text class="section-note">（为你的约见/组队补充信息）</text></view>
        <view class="schedule-form">
          <text class="schedule-tip">日期用日历选择，时间直接填写（24小时制，北京时间）。支持今天及跨天活动，集合至少提前1小时。</text>
          <view v-for="field in scheduleFields" :key="field.date" class="schedule-field">
            <text class="schedule-label">{{ field.label }}</text>
            <view class="schedule-inputs">
              <view class="schedule-date" hover-class="k-press" @click="pickScheduleDate(field.date)"><text>{{ act[field.date] }}</text><k-icon name="calendar" :size="18" color="muted" /></view>
              <input v-model="act[field.time]" class="schedule-clock" :aria-label="field.label + '时刻'" type="text" maxlength="5" placeholder="09:30" :cursor-spacing="28" @blur="normalizeTime(field.time)" />
            </view>
          </view>
          <text v-if="scheduleError" class="schedule-error">{{ scheduleError }}</text>
        </view>
        <view class="activity-info"><view v-for="item in activityRows" :key="item.label" class="activity-row" hover-class="k-press" @click="editRow(item)"><text>{{ item.label }}</text><view class="activity-row__right"><template v-if="item.label === '参与人数'"><view class="round-op" hover-class="k-press" hover-stop-propagation @click.stop="people = Math.max(2, people - 1)"><k-icon name="minus" :size="16" color="ink" :stroke="2" /></view><text class="people">{{ people }}人</text><view class="round-op" hover-class="k-press" hover-stop-propagation @click.stop="people = Math.min(50, people + 1)"><k-icon name="plus" :size="16" color="ink" :stroke="2" /></view></template><text v-else>{{ item.value }}</text><k-icon v-if="item.label !== '参与人数'" name="chevron-right" :size="18" color="muted" /></view></view></view>
        <text class="preview-label">活动预览</text>
        <view class="preview-card"><image class="preview-img" :src="previewImg" mode="aspectFill" /><view class="preview-copy"><text class="preview-chip">找搭子 · 组队</text><text class="preview-title">{{ previewTitle }}</text><view class="preview-meta"><k-icon name="map-pin" :size="13" color="muted" /><text>{{ previewMeta }}</text></view><view class="preview-meta"><k-icon name="eye" :size="13" color="muted" /><text>{{ previewQuota }}</text></view><view class="preview-sign"><view class="avatar-stack"><image v-for="a in avatars" :key="a" class="preview-avatar" :src="a" mode="aspectFill" /></view><text>{{ syncOn ? '发布后开始接受报名' : '不同步活动，仅发布找搭子动态' }}</text></view></view></view>
        <view class="dual-buttons sync-buttons"><view class="dual-button"><k-button type="outline" size="lg" block @click="s = 1">上一步</k-button></view><view class="dual-button"><k-button size="lg" block @click="publishBuddy">发布</k-button></view></view>
      </view>
      <k-tabbar active="publish" />
    </template>
    <publish-consent ref="publishConsent" />
    <k-date-picker v-if="calendarTarget" :title="calendarTitle" :value="calendarValue" :min-date="calendarMin" :allow-empty="calendarTarget === 'post'" @cancel="calendarTarget = ''" @confirm="confirmDate" />
  </view>

  </k-community-gate>
</template>

<script setup>
import PublishConsent from './components/publish-consent.vue'
import { restoreSchedule, checkSchedule } from './buddy-schedule.js'
import { normalizeClock } from '@/common/manual-time.js'
const publishConsent = ref(null)
import { selectCity } from '@/common/city-picker.js'
// ---------------------------------------------------------------------------
// 发布（用户端）接入情况：
//   s=1 发布内容（2026-10-17 改版，对照主人样稿 图 3）：类型三个大胶囊（找搭子 / 经验分享 / 旅居日常）/ 白卡里图片（上传到服务器，最多 9 张，第一张是封面）/ 标题正文；
//       「关联帖子」卡：三类都可关联一个 小院 / 门店、岗位 或 活动（选择页 pages/community/link；2026-10-17 r2 起存在 link_type / link_id，
//       找搭子、旅居日常另写一份 ref_type / ref_id；经验分享也能选了，不选时自动关联经历的岗位）；
//       「补充信息」卡（默认收起）：城市 / 日期，找搭子另有「同行性别」（不限 / 仅限女生 / 仅限男生），
//       旅居日常（原「旅居日常」，后端代码还是 daily）另有「伙伴说」（推荐 / 避雷，可不选 = 不传）；
//       同行性别 / 伙伴说使用页面内按钮组；分类由服务端识别，同步活动时按活动时长计算天数；
//       草稿只存本机一份、按账号分开；打开时有草稿就问「恢复 / 丢弃」，右上角「草稿箱」可继续编辑或删除；底部固定「存草稿 / 发布」
//       发出去后进「发布成功」页（pages/community/published）：发布成功 / 已提交审核、已关联到 XXX、查看帖子 / 继续发布 / 回社区
//   s=2 手机验证：小程序用微信「手机号快速验证」（open-type=getPhoneNumber），H5 联调环境走模拟通道；号码不向其他用户展示
//   s=3 经历校验：经验分享（原「换工日记」，后端代码还是 diary）必须关联一段本人已完成的换宿 / 兼职 / 全职经历（服务端再校验一次）
//   s=4 同步活动板：找搭子可同时发起一个免费的「用户自发」活动（集合时间 / 地点 / 时长 / 人数 / 截止）
// 发布前需要同意《社区公约》（找搭子还要同意《找搭子安全须知》，都由 gated() 弹全文、同意后自动重发）；
// 找搭子、发起活动还需要手机号已验证；内容先经本地敏感词检查，生产环境一律先审后发。
// ---------------------------------------------------------------------------
import { ref, computed } from 'vue'
import { useScreen, go, back, replace, toast } from '@/common/screen.js'
import { apiPublishPost, apiExperiences, apiCommunityStatus } from '@/common/api.js'
import { ensureSession, experience } from '@/common/experience.js'
import { sheet, prompt, confirm, modal, shiftDate, todayCn, isYmd } from '@/common/ui.js'
import { gated, fail, currentCity, verifyPhone } from '@/common/community.js'
import { uploadTo, chooseImages, absUrl } from '@/common/upload.js'
import { TONES } from '@/common/post-share.js'
import R from '@/common/routes.js'
import { listDrafts, saveLocalDraft, removeLocalDraft, migrateLocalDrafts } from '@/common/local-drafts.js'
import { PUBLISH_TYPES, PUBLISH_KIND, JOB_CHIPS, restoreType, typeOfKind } from './community-feed.js'
import { openLinkPicker, restoreLink, linkFromQuery, linkPayload, rememberPublished, publishedUrl, DIARY_AUTO_LINK_HINT } from './post-link.js'

let needPhoneOnly = false
const s = useScreen(4, {
  onLoad: async (q) => {
    await ensureSession()
    // 2026-10-17：?kind=daily 预选旅居日常（会员信息「赚取积分」点「去完成」进来）；之后要恢复本机草稿的，照旧按草稿里的类型
    if (typeOfKind(q?.kind)) pickType(typeOfKind(q.kind))
    if (q?.need === 'phone') { needPhoneOnly = true; s.value = 2; return }
    // 2026-10-18：从岗位「寻伴同行」进来（?kind=buddy&linkType=job&linkId=…）：「关联帖子」先选好这个岗位；
    // 之后本机有草稿、点了「恢复草稿」的，以草稿里的为准（applyDraft 整个换掉），丢弃草稿的照旧保留这个岗位
    const preLink = linkFromQuery(q)
    if (preLink) link0.value = preLink
    migrateDraft()
    activeDraftId = String(q?.draftId || '')
    const saved=readDraft()
    if(saved)restoreDraft(saved)
  }
})

// ---------------- s=1 ----------------
const type = ref('找搭子')
// 类型：找搭子 / 经验分享 / 旅居日常（样稿 图 3 的顺序；经验分享 = 原「换工日记」，发给服务端的还是 diary；旅居日常 = 原「旅居日常」，还是 daily）
const KIND = PUBLISH_KIND
const types = PUBLISH_TYPES
// 每个类型自己的标题 / 正文提示字、「补充信息」副标题
const typeInfo = computed(() => types.find(t => t.name === type.value) || types[0])
// 旅居日常点了直接发；找搭子还要验证手机、同步活动，经验分享还要选经历：按钮写「下一步」，不让人以为点了就发出去了
const nextLabel = computed(() => submitting.value ? '发布中…' : (type.value === '旅居日常' ? '发布' : '下一步'))
function pickType(name) {
  type.value = name
  // 一选「经验分享」就查可关联的经历，没有可用经历时类型卡下面直接说明（不用等写完正文）
  if (name === '经验分享') loadExperiences()
}
// 经验分享的「选择经历类型」：换宿旅行 / 线下兼职 / 全职，只是预选（再点一下取消）；经历校验页把这一类排在前面、先选上一段
const EXP_TYPES = JOB_CHIPS.filter(j => j.key)
const expType = ref('')
function pickExpType(key) {
  expType.value = expType.value === key ? '' : key
  preselectExp()
}
const uploads = ref([])
const removeUpload = (index) => uploads.value.splice(index, 1)
async function addImages() {
  const left = 9 - uploads.value.length
  if (left <= 0) return toast('最多 9 张图片')
  const paths = await chooseImages(left)
  if (!paths.length) return
  // 带遮罩：上传中再点「+」会叠着再选一批图
  uni.showLoading({ title: '上传中', mask: true })
  try {
    for (const p of paths) {
      const up = await uploadTo('/app/upload/image', p)
      uploads.value.push({ url: up.data.url, img: absUrl(up.data.url) })
    }
  } catch (e) {
    fail(e, '图片上传失败')
  } finally {
    uni.hideLoading()
  }
}
// 封面右下角的铅笔：换一张封面（只换第一张，其余的图不动）
async function replaceCover() {
  const paths = await chooseImages(1)
  if (!paths.length) return
  uni.showLoading({ title: '上传中', mask: true })
  try {
    const up = await uploadTo('/app/upload/image', paths[0])
    uploads.value.splice(0, 1, { url: up.data.url, img: absUrl(up.data.url) })
  } catch (e) {
    fail(e, '图片上传失败')
  } finally {
    uni.hideLoading()
  }
}
const title = ref('')
const body = ref('')
// 只在打字时才渲染真的 textarea（原生层会盖住底部导航、抢走点击）
const editingBody = ref(false)
const city = ref(currentCity())
async function pickCity() {
  const value = await selectCity({ value: city.value })
  if (value === null) return
  city.value = value
}
const eventDate = ref('')
const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const cnDate = (ymd) => { const d = new Date(ymd + 'T00:00:00'); return `${d.getMonth() + 1}月${d.getDate()}日（${WEEK[d.getDay()]}）` }
const dateLabel = computed(() => (eventDate.value ? cnDate(eventDate.value) : '不限日期'))
// 「补充信息」卡默认收起：副标题显示城市、日期、同行性别或伙伴说
const extraOpen = ref(false)
const extraSummary = computed(() => {
  const out = [city.value, dateLabel.value]
  if (type.value === '找搭子') {
    if (genderLimit.value) out.push(genderLimitLabel.value)
  }
  if (type.value === '旅居日常' && tone.value) out.push('伙伴说：' + toneText.value)
  return out.filter(Boolean).join(' · ')
})
const calendarTarget = ref('')
const calendarMin = ref(todayCn())
function pickDate() {
  calendarMin.value = todayCn()
  calendarTarget.value = 'post'
}
function confirmDate(date) {
  const target = calendarTarget.value
  calendarTarget.value = ''
  if (target === 'post') eventDate.value = date
  else if (target) act.value[target] = date
}
const scheduleFields = [
  { label: '集合时间', date: 'date', time: 'time' },
  { label: '结束时间', date: 'endDate', time: 'endTime' },
  { label: '报名截止', date: 'deadlineDate', time: 'deadlineTime' }
]
const calendarTitle = computed(() => calendarTarget.value === 'post' ? '选择日期' : `选择${scheduleFields.find(x => x.date === calendarTarget.value)?.label || ''}日期`)
const calendarValue = computed(() => calendarTarget.value === 'post' ? eventDate.value : act.value[calendarTarget.value])
function pickScheduleDate(key) {
  uni.hideKeyboard()
  calendarMin.value = todayCn()
  calendarTarget.value = key
}
function normalizeTime(key) {
  const normalized = normalizeClock(act.value[key])
  if (normalized) act.value[key] = normalized
}
// 同行性别可选，默认不限
const GENDER_LIMITS = [{ label: '不限', key: '' }, { label: '仅限女生', key: 'female' }, { label: '仅限男生', key: 'male' }]
const keyIn = (list, v) => (list.some(x => x.key === v) ? v : '')
const genderLimit = ref('')
const genderLimitLabel = computed(() => (GENDER_LIMITS.find(x => x.key === genderLimit.value) || GENDER_LIMITS[0]).label)
// 之前发旅居日常（现在叫旅居日常）没法说明是推荐还是避雷；现在可选「伙伴说」，默认不选
const tone = ref('')
const toneText = computed(() => (tone.value ? (TONES.find(x => x.key === tone.value) || TONES[0]).label : '不选'))
// 关联帖子（2026-10-17）：之前这里是「关联订单或岗位」（自己的报名 / 住宿订单，发出去哪里都不显示）；
// 现在换成关联一个公开的 小院 / 门店、岗位 或 活动（主人拍板，不关联别人的帖子），帖子里显示「关联：XXX」可以点过去。
// 选择页返回：选了一个 → 关联它；点「不关联」→ 'none'；直接返回 → null（不变）
const link0 = ref(null)
const LINK_ICON = { stay: 'house', store: 'store', job: 'briefcase-business', activity: 'calendar-days', post: 'file-text' }
const linkIcon = (t) => LINK_ICON[t] || 'link'
async function pickLink() {
  const res = await openLinkPicker({ city: city.value, current: link0.value }, (o) => uni.navigateTo(o))
  if (res === null) return
  link0.value = res === 'none' ? null : restoreLink(res)
}
const clearLink = () => { link0.value = null }
// 没选关联时卡上的副标题：经验分享写明不选会自动关联经历的岗位（2026-10-17 r2）
const linkSub = computed(() => (type.value === '经验分享' ? DIARY_AUTO_LINK_HINT : '关联小院 / 门店、岗位、活动或自己的另一篇帖子，读者可直接打开'))
// ---------------- 草稿（只存本机一份） ----------------
// 之前打开发布页静默填回草稿、又没有丢弃的地方，看起来像「自动保存、删不掉」；只有图片的草稿也恢复不出来；
// 草稿键不分账号，同一台手机换账号会看到上一个账号的草稿。现在（照员工活动草稿 staff/activities.vue 的做法）：
// 键名带账号 id；打开时有草稿就问「恢复 / 丢弃」，写上标题、类型和保存时间；恢复后表单顶部一条提示可「清空」；
// 右上角「草稿箱」可继续编辑或删除；关联的对象、经历类型、同步活动的信息也一起存
let activeDraftId = ''
const draftCount = ref(0)
const draftInfo = ref(null)
const hasContent = d => !!(d && (String(d.title || '').trim() || String(d.body || '').trim() || d.uploads?.length))
function migrateDraft(){ migrateLocalDrafts(experience.account?.id) }
function readDraft(){
  if (!experience.account?.id) return null
  const rows=listDrafts(experience.account.id,'community');draftCount.value=rows.length
  const row=rows.find(x=>x.id===activeDraftId)
  return row ? {...row.data, savedAt:new Date(row.updatedAt).toLocaleString(), _id:row.id} : null
}
const restoredAt = ref('')    // 恢复了草稿：顶部提示条（值是草稿的保存时间，老草稿没有时间记作 '-'）
const restoredText = computed(() => (restoredAt.value && restoredAt.value !== '-' ? `已恢复 ${restoredAt.value} 存的草稿` : '已恢复本机草稿'))
// 这份草稿是不是本页恢复 / 保存的：是的话再存不用问覆盖，发布成功后删掉；没恢复的旧草稿发布别的内容时留着
let draftMine = false
const draftName = (d) => (String(d.title || '').trim() ? `「${String(d.title).trim()}」` : (d.uploads && d.uploads.length ? `（只有 ${d.uploads.length} 张图片）` : '（未填标题）'))
const draftDesc = (d) => `${draftName(d)}，类型：${restoreType(d.type)}${d.savedAt ? '，保存于 ' + d.savedAt : ''}`
function dropDraft() {
  if(activeDraftId) removeLocalDraft(experience.account.id, activeDraftId)
  activeDraftId='';draftInfo.value=null;restoredAt.value='';draftMine=false;readDraft()
}
function snapshot() {
  return {
    type: type.value, title: title.value, body: body.value, city: city.value, eventDate: eventDate.value,
    uploads: uploads.value.map(u => ({ url: u.url, img: u.img })),
    genderLimit: genderLimit.value, tone: tone.value,
    link: link0.value ? { ...link0.value } : null, expType: expType.value,
    act: { ...act.value }, people: people.value, syncOn: syncOn.value
  }
}
function applyDraft(d) {
  // 改名前存下的草稿类型是「换工日记」「旅居日常」：认成「经验分享」「旅居日常」，否则查不到类型、发布时报「请选择发布类型」
  type.value = restoreType(d.type, '找搭子')
  title.value = String(d.title || '').slice(0, 60)
  body.value = String(d.body || '').slice(0, 500)
  city.value = d.city || currentCity()
  // 日期只能选今天以后：过了期的不恢复
  eventDate.value = isYmd(d.eventDate) && d.eventDate >= todayCn() ? d.eventDate : ''
  uploads.value = (Array.isArray(d.uploads) ? d.uploads : []).filter(u => u && u.url).slice(0, 9).map(u => ({ url: u.url, img: u.img || absUrl(u.url) }))
  // 已移除的分类、同行天数不从旧草稿恢复，避免提交用户无法修改的隐藏选项。
  genderLimit.value = keyIn(GENDER_LIMITS, d.genderLimit)
  tone.value = keyIn(TONES, d.tone)
  // 老草稿存的是自己的报名 / 住宿订单（d.ref），新版不再用，不恢复；只认支持的公开对象
  link0.value = restoreLink(d.link)
  expType.value = EXP_TYPES.some(j => j.key === d.expType) ? d.expType : ''
  act.value = restoreSchedule(d.act, shiftDate(todayCn(), 2))
  const n = Number(d.people)
  people.value = n >= 2 && n <= 50 ? Math.round(n) : 10
  syncOn.value = d.syncOn !== false
  selected.value = 0
  if (type.value === '经验分享') loadExperiences()
}
function restoreDraft(d) {
  applyDraft(d)
  restoredAt.value = d.savedAt || '-'
  draftMine = true
  activeDraftId = d._id || activeDraftId
  draftInfo.value = d
}
// 回到空白表单（类型回到默认的找搭子）
function resetForm() {
  applyDraft({})
  restoredAt.value = ''
}
// 打开发布页：本机有草稿就问恢复还是丢弃（之前是静默填回）
async function offerDraft() { readDraft() }
// 顶部提示条的「清空」：表单清空，本机草稿一起删
async function clearDraft() {
  if (!(await confirm('清空草稿', '表单会清空，本机这份草稿也会删除，不能恢复。确定清空？'))) return
  dropDraft()
  resetForm()
  toast('已清空')
}
const sameAsForm = (d) => JSON.stringify({ ...snapshot(), savedAt: undefined }) === JSON.stringify({ ...d, savedAt: undefined })
// 「草稿」入口：看标题 / 类型 / 保存时间，继续编辑或删除
async function openDraft() { go('/pages/profile/drafts') }
async function saveDraft() {
  const data=snapshot()
  if(!hasContent(data))return toast('还没有填写标题、正文或图片')
  try {
    const previous=readDraft()
    const row=saveLocalDraft(experience.account.id,{id:previous?.type===data.type?activeDraftId:'',kind:'community',label:data.type,data})
    activeDraftId=row.id;draftMine=true;draftInfo.value=readDraft();restoredAt.value=draftInfo.value.savedAt
    toast('草稿已保存，可在我的草稿箱继续编辑')
  }catch(e){toast(e.message||'保存失败，请重试')}
}
const phoneVerified = ref(false)
async function next() {
  if (submitting.value) return
  if (!title.value.trim()) return toast('请填写标题')
  if (type.value === '经验分享') { loadExperiences(); s.value = 3; return }
  if (type.value === '旅居日常') return submit()
  try {
    phoneVerified.value = !!(await apiCommunityStatus()).data.phoneVerified
  } catch (e) { /* 以服务端发布时的校验为准 */ }
  s.value = phoneVerified.value ? 4 : 2
}

// ---------------- s=2 手机验证 ----------------
const phoneText = computed(() => {
  const p = String(experience.account?.phone || '')
  return p ? p.replace(/^(\d{3})\d{4}(\d{4})$/, '$1 **** $2') : '未绑定手机号'
})
async function onPhone(e) {
  try {
    await verifyPhone(e)
    toast('手机号已验证')
    if (needPhoneOnly) return back()
    s.value = 4
  } catch (err) {
    fail(err, '验证失败')
  }
}
const onPhoneClick = () => {
  // #ifdef H5
  onPhone(null)
  // #endif
}
const changeAccount = () => toast('请点击“授权并验证”，按手机号授权窗口提示重新授权')
// 之前从别处（发起活动 / 评论被要求验证手机）进来只为验证手机号，点返回却落到一张空白的发布表单；现在直接回到来源页
const leavePhone = () => (needPhoneOnly ? back() : (s.value = 1))

// ---------------- s=3 经历校验 ----------------
const selected = ref(0)
const expList = ref([])
// 暂时还不能用的报名（服务端在列表旁边给 unavailable: [{ appId, jobTitle, storeName, jobTypeLabel, reason }]；老接口没有就是空）
const expOffRaw = ref([])
// 加载完再判断有没有经历：之前一进来先闪一下「还没有可用的已完成经历」
const expLoaded = ref(false)
const expFailed = ref(false)
let expSeq = 0
async function loadExperiences() {
  // 连着切类型会连发请求：只认最后一次
  const seq = ++expSeq
  expFailed.value = false
  try {
    const res = await apiExperiences()
    if (seq !== expSeq) return
    const data = res && res.data
    expList.value = Array.isArray(data) ? data : ((data && (data.list || data.rows)) || [])
    const off = (res && res.unavailable) || (data && !Array.isArray(data) && data.unavailable) || []
    expOffRaw.value = Array.isArray(off) ? off : []
    expLoaded.value = true
    preselectExp()
  } catch (e) {
    if (seq !== expSeq) return
    expFailed.value = true
    fail(e, '经历加载失败')
  }
}
// 服务端的时间是「开始–结束」（yyyy.MM.dd–yyyy.MM.dd）：结束日在今天以后的是「进行中」（已到岗、还没做完，也能分享）
const endYmd = (date) => { const m = /(\d{4})\.(\d{2})\.(\d{2})\s*$/.exec(String(date || '')); return m ? `${m[1]}-${m[2]}-${m[3]}` : '' }
const experiences = computed(() => {
  const list = expList.value.map((x) => {
    const end = endYmd(x.date)
    const ongoing = x.ongoing === true || (!!end && end > todayCn())
    return { ...x, img: x.img ? absUrl(x.img) : '/static/media/cover-empty.png', ongoing,
      stateText: x.statusLabel || (ongoing ? '进行中' : '已完成'), dateLabel: ongoing ? '时间' : '完成时间' }
  })
  // 发布页预选了经历类型：这一类排在前面（其余照常列出来、也能选）
  return expType.value ? [...list.filter(x => x.jobType === expType.value), ...list.filter(x => x.jobType !== expType.value)] : list
})
// 预选了经历类型、又还没选这一类的经历时，先选上这一类的第一段（没有这一类的就不动）
function preselectExp() {
  if (!expType.value) return
  const cur = experiences.value.find(x => x.appId === selected.value)
  if (cur && cur.jobType === expType.value) return
  const hit = experiences.value.find(x => x.jobType === expType.value)
  if (hit) selected.value = hit.appId
}
const expOff = computed(() => expOffRaw.value.filter(x => x && typeof x === 'object').map((x, i) => ({
  key: 'off' + (x.appId || i),
  // 服务端 unavailable 的每条和可用经历同一套字段（title 已带门店名）；jobTitle / storeName 是早先约定的写法，两种都认
  title: x.title || [x.jobTitle, x.storeName].filter(Boolean).join(' · ') || '岗位报名',
  jobTypeLabel: x.jobTypeLabel || '',
  reason: x.reason || '暂时还不能用'
})))
const expHintSub = computed(() => (expOff.value.length
  ? `你有 ${expOff.value.length} 段报名还不能用来发经验分享，点「查看原因」看每一段的原因`
  : '换宿、兼职、全职到岗后，就能发经验分享'))
// 经验分享换宿、兼职、全职都算：去找机会不再写死换宿（?type=volunteer），打开岗位列表的默认页签，用户自己切
const goJobs = () => go(R.jobsList)
const submitDiary = () => {
  const hit = experiences.value.find(x => x.appId === selected.value)
  if (!hit) return toast('请选择一段经历')
  submit({ refType: 'application', refId: hit.appId })
}

// ---------------- s=4 同步活动板 ----------------
const syncOn = ref(true)
const people = ref(10)
const act = ref(restoreSchedule(null, shiftDate(todayCn(), 2)))
const startText = computed(() => `${cnDate(act.value.date)}${act.value.time}`)
const scheduleError = computed(() => checkSchedule(act.value).error || '')
const activityRows = computed(() => [
  { label: '集合地点', value: act.value.place || '请填写' },
  { label: '参与人数', value: '' }
])
async function editRow(item) {
  if (item.label === '集合地点') {
    const choice=await sheet(['地图搜索并选择地点','手动填写地点'])
    if(choice===0){uni.chooseLocation({success:r=>{act.value.place=[r.name,r.address].filter(Boolean).join(' · ').slice(0,60)},fail:e=>{if(!/cancel/i.test(e?.errMsg||''))toast('地图暂不可用，可选择手动填写地点')}})}
    else if(choice===1){const v=await prompt('集合地点',{value:act.value.place,placeholder:'选公共场所，例如：洗马潭索道口'});if(v)act.value.place=v.slice(0,60)}
  }
}
const previewImg = computed(() => (uploads.value[0] ? uploads.value[0].img : '/static/media/cover-empty.png'))
const previewTitle = computed(() => title.value || '给活动起个标题')
const previewMeta = computed(() => `${startText.value}  ${city.value} · ${act.value.place || '集合地点待填写'}`)
const previewQuota = computed(() => `${people.value}人 · 报名截止 ${act.value.deadlineDate} ${act.value.deadlineTime}`)
const avatars = computed(() => [experience.account?.avatar ? absUrl(experience.account.avatar) : '/static/media/profile-avatar.jpg'])
function publishBuddy() {
  if (!syncOn.value) return submit()
  if (!act.value.place) return toast('请填写集合地点')
  if (people.value < 2 || people.value > 50) return toast('人数为 2–50 人')
  const schedule = checkSchedule(act.value)
  if (schedule.error) return toast(schedule.error)
  submit({
    eventDate: act.value.date, eventDays: schedule.hours >= 24 ? '2-3天' : (schedule.hours > 6 ? '1天' : '半天'),
    syncActivity: { startTime: schedule.startTime, endTime: schedule.endTime, place: act.value.place, capacity: people.value, deadline: schedule.deadline }
  })
}

// ---------------- 发布 ----------------
const submitting = ref(false)
async function submit(extra = {}) {
  if (submitting.value) return
  if (!title.value.trim()) { s.value = 1; return toast('请填写标题') }
  const payload = {
    kind: KIND[type.value], title: title.value.trim(), content: body.value.trim(), city: city.value,
    images: uploads.value.map(u => u.url).filter(u => /^\/profile\//.test(u)), eventDate: eventDate.value || undefined,
    // 关联的 小院 / 门店 / 岗位 / 活动 → linkType / linkId（2026-10-17 r2，经验分享也带），找搭子 / 旅居日常另带一份 refType / refId；
    // 经验分享不带 refType / refId（它的 ref 是经历校验那段报名，由 extra 给）
    ...linkPayload(KIND[type.value], link0.value), ...extra
  }
  if (!isYmd(payload.eventDate || '2000-01-01')) delete payload.eventDate
  if (payload.kind === 'buddy') {
    // 分类由服务端识别；eventDays 仅来自同步活动；同行性别 '' = 不限。
    payload.genderLimit = genderLimit.value
  }
  if (payload.kind === 'daily' && tone.value) payload.tone = tone.value
  submitting.value = true
  try {
    const required = ['community', ...(payload.kind === 'buddy' ? ['buddy'] : []), ...(payload.syncActivity ? ['activity'] : [])]
    if (!(await publishConsent.value.open(required))) { submitting.value = false; return }
    const res = (await gated(() => apiPublishPost(payload), { onPhone: () => { toast('请先验证手机号'); s.value = 2 } })).data
    if (!Number.isSafeInteger(Number(res?.postId)) || Number(res.postId) <= 0) throw new Error('未获取到发布结果，请先到「我的发布」确认')
    // 发出去的就是本页恢复 / 保存的那份草稿才删；没恢复的旧草稿留着
    if (draftMine) dropDraft()
    // 2026-10-17：之前发完直接换成「我的发布」页（顶上一条「内容已提交」），不知道是发出去了还是在审核、关联上没有；
    // 现在进「发布成功」页：发布成功 / 已提交审核、已关联到 XXX，按钮 查看帖子 / 继续发布 / 回社区（从别处进「我的发布」带 ?submitted= 的高亮照旧）
    rememberPublished(res, payload.kind)
    replace(publishedUrl(res))
  } catch (e) {
    fail(e, '发布失败')
    submitting.value = false
  }
}
</script>

<style scoped lang="scss">
.schedule-form { padding:16px; border:1px solid var(--k-line2); border-radius:16px; background:var(--k-paper); margin-bottom:16px; }
.schedule-tip { display:block; color:var(--k-muted); font-size:13px; line-height:1.65; margin-bottom:16px; }
.schedule-field + .schedule-field { margin-top:14px; }
.schedule-label { display:block; font-weight:600; font-size:14px; margin-bottom:7px; }
.schedule-inputs { display:flex; gap:10px; }
.schedule-date { flex:1; min-width:0; display:flex; justify-content:space-between; align-items:center; gap:6px; padding:0 10px; border:1px solid var(--k-line2); border-radius:8px; min-height:44px; font-size:14px; }
.schedule-clock { box-sizing:border-box; width:82px; min-height:46px; padding:0 8px; border:1px solid var(--k-line2); border-radius:8px; font-size:16px; text-align:center; }
.schedule-error { display:block; margin-top:14px; font-size:13px; line-height:1.6; color:var(--k-alert); }

/* 2026-10-17 发布页改版（对照主人样稿 图 3）：暖白底 + 白色大圆角卡 + 很柔的阴影；主按钮、选中的类型是暖棕→深棕渐变（只在本页，不动全局主题） */
/* 2026-10-19 一比一还原：渐变换成全站统一的暖棕渐变（和 theme.scss 的 --k-grad-brown 同一组色；scss 变量留着，下面十几处不用改） */
$k-grad: linear-gradient(135deg, #B07A47 0%, #8A5A30 100%);
.publish-page { background: var(--k-bg); }
/* 顶部很淡的暖色渐变，和样稿一样往下化进页面底色 */
/* 2026-10-19：渐变从顶栏同色起步（之前一上来就是 #F8EEE1，吸顶顶栏下沿有一道色差），再到暖米色、最后化进页面底色 */
.publish-body { min-height: 60vh; padding: 6px 16px calc(96px + var(--k-safe-bottom)); }
/* 右上角「草稿箱」：描边小胶囊（小程序里排在微信胶囊左边） */
.pub-tools { display: flex; justify-content: flex-end; margin-bottom: 8px; }
.drafts { min-height: 44px; padding: 0 4px 0 12px; color: var(--k-red-deep); font-size: 13px; display: flex; align-items: center; gap: 5px; white-space: nowrap; }
.drafts__num { min-width: 16px; height: 16px; padding: 0 4px; border-radius: 8px; background: var(--k-red); color: #fff; font-size: 10px; line-height: 16px; text-align: center; }
/* 恢复草稿后的提示条 */
.draft-bar { margin: 4px 0 10px; padding: 9px 12px; border-radius: 12px; background: var(--k-ochre-soft); display: flex; align-items: center; gap: 7px; font-size: 13px; color: var(--k-ink2); }
.draft-bar__text { min-width: 0; flex: 1; }
.draft-bar__clear { flex-shrink: 0; margin: -9px -12px -9px 0; padding: 9px 12px; color: var(--k-red); font-weight: 600; }
/* 类型：三个等宽大胶囊，选中暖棕渐变白字、未选米色底深棕字 */
.type-pills { display: flex; gap: 10px; margin-top: 6px; }
/* 2026-10-19 参考图：未选是浅暖灰底 + 一圈极淡的暖色细边，选中暖棕渐变白字（更高、更粗） */
.type-pill { flex: 1; min-width: 0; height: 48px; border-radius: 999px; background: var(--k-paper2); color: var(--k-ink2); font-size: 15px; font-weight: 500; display: flex; align-items: center; justify-content: center; white-space: nowrap; }
.type-pill.active { background: var(--k-red); color: var(--k-paper); font-weight: 600; }
/* 320 宽：三个胶囊挤一行，字小一号 */
@media (max-width: 359px) {
  .type-pills { gap: 6px; }
  .type-pill { font-size: 14px; letter-spacing: 0; }
}
/* 经验分享的「选择经历类型」：一行描边小胶囊，选中橙棕描边 + 浅底 */
.exp-types { margin-top: 12px; display: flex; align-items: center; gap: 10px; }
.exp-types__label { flex: 0 0 auto; font-size: 14px; font-weight: 600; color: var(--k-ink); }
.exp-types__pills { min-width: 0; flex: 1; display: flex; flex-wrap: wrap; gap: 6px; }
.exp-type-pill { height: 40px; padding: 0 12px; border: 1px solid var(--k-line2); border-radius: 999px; background: transparent; color: var(--k-ink2); font-size: 13px; display: flex; align-items: center; }
.exp-type-pill.on { border-color: #C9935F; background: #F6EBDD; color: #8A5A30; font-weight: 600; }
/* 320 宽：标签和三个胶囊一行放不下（之前胶囊折成两行、左边标签悬在中间）—— 标签单独一行，三个胶囊等宽排一行 */
@media (max-width: 359px) {
  .exp-types { flex-direction: column; align-items: stretch; gap: 8px; }
  .exp-types__pills { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .exp-type-pill { justify-content: center; padding: 0 6px; }
}
/* 选「经验分享」后类型下面的经历提示 */
.exp-hint { margin-top: 12px; padding: 10px 12px; border-radius: 12px; background: var(--k-paper2); }
.exp-hint__row { display: flex; align-items: center; gap: 7px; }
.exp-hint__text { min-width: 0; flex: 1; font-size: 13px; color: var(--k-ink2); line-height: 1.45; }
.exp-hint--warn { background: var(--k-ochre-soft); box-shadow: none; }
.exp-hint__title { min-width: 0; flex: 1; font-size: 14px; font-weight: 600; color: var(--k-ink); }
.exp-hint__sub { display: block; margin-top: 5px; padding-left: 23px; font-size: 12px; color: var(--k-ink2); line-height: 1.5; }
.exp-hint__links { display: flex; gap: 18px; margin-top: 4px; padding-left: 23px; }
.exp-hint__link { display: flex; align-items: center; gap: 2px; padding: 6px 0; color: var(--k-red); font-size: 13px; font-weight: 600; }
/* 经历校验 / 同步活动板这两屏还在用的小标题 */
.section-head, .experience-head, .activity-title-row { display: flex; align-items: center; justify-content: space-between; }
.section-title { font-family: var(--k-serif); font-size: 17px; font-weight: 700; }
.section-note { color: var(--k-muted); font-size: 11px; }
/* 白色大卡：图片 / 标题 / 正文 */
/* 2026-10-19：大卡圆角 22、暖色柔阴影 + 极淡细边（全局视觉语言） */
.compose { margin-top: 20px; padding: 14px 14px 6px; border-radius: 16px; background: var(--k-paper); }
/* 还没有图：一整块虚线框「添加照片 / 最多 9 张」 */
.media-empty { height: 132px; border: 1px dashed var(--k-line2); border-radius: 12px; background: var(--k-bg); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; }
.media-empty__icon { width: 48px; height: 48px; margin-bottom: 4px; border-radius: 50%; background: var(--k-red-soft); display: flex; align-items: center; justify-content: center; }
.media-empty__title { font-size: 15px; font-family: var(--k-display-font); font-weight: 700; color: var(--k-ink); }
.media-empty__sub { font-size: 12px; color: var(--k-muted); }
/* 封面大图（2026-10-18 样稿：16:9 圆角）：左上「封面」，右上删除，底部一条「更换封面 / 最多 9 张图片」+ 右下暖棕铅笔圆钮 */
.cover { position: relative; height: 0; padding-top: 56.25%; border-radius: 16px; overflow: hidden; background: var(--k-paper2); }
.cover__img { position: absolute; left: 0; top: 0; width: 100%; height: 100%; }
.cover__shade { position: absolute; left: 0; right: 0; bottom: 0; height: 64px; background: linear-gradient(180deg, rgba(20,14,8,0) 0%, rgba(20,14,8,.5) 100%); }
.cover__tag { position: absolute; left: 10px; top: 10px; height: 22px; padding: 0 8px; border-radius: 999px; background: rgba(36, 27, 23, .55); color: #fff; font-size: 11px; font-weight: 600; line-height: 22px; }
.upload-close.cover__close { right: 8px; top: 8px; width: 24px; height: 24px; }
.cover__edit { position: absolute; left: 0; right: 0; bottom: 0; height: 56px; padding: 0 10px 0 14px; display: flex; align-items: center; justify-content: space-between; gap: 8px; color: #fff; }
.cover__edit-copy { min-width: 0; display: flex; flex-direction: column; font-size: 14px; font-weight: 700; line-height: 1.35; text-shadow: 0 1px 3px rgba(0,0,0,.35); }
.cover__edit-sub { font-size: 11px; font-weight: 400; opacity: .92; }
/* 铅笔圆钮（封面右下、经验分享大格右下、旅居日常空封面右下）：2026-10-19 复查按样稿改成橙色渐变（全站强调橙，和社区搜索圆钮同一组） */
.cover__pen { flex: 0 0 auto; width: 40px; height: 40px; border-radius: 50%; background: var(--k-red); border: 2px solid var(--k-paper); box-sizing: border-box; display: flex; align-items: center; justify-content: center; }
.cover__pen--corner { position: absolute; right: 12px; bottom: 12px; }
/* 320 宽：空封面只有约 145px 高，「最多 9 张图片…」那行和右下铅笔挨得太近 —— 提示字往上挪一点、铅笔小一号贴角 */
@media (max-width: 359px) {
  .cover__hint { top: 45%; }
  .cover__pen--corner { right: 8px; bottom: 8px; width: 32px; height: 32px; }
}
/* 旅居日常还没有图：16:9 暖色渐变占位，中间「添加封面」 */
.cover.cover--empty { background: var(--k-bg); border: 1px dashed var(--k-line2); box-sizing: border-box; }
.cover__hint { position: absolute; left: 0; right: 0; top: 50%; transform: translateY(-50%); display: flex; flex-direction: column; align-items: center; gap: 4px; }
.cover__hint-title { margin-top: 2px; font-family: var(--k-display-font); font-size: 16px; font-weight: 700; color: var(--k-ink); letter-spacing: .5px; }
.cover__hint-sub { font-size: 12px; color: var(--k-muted); }
/* 经验分享：照片九宫格，第一格占 2×2（添加经历照片 / 封面），其余小格；格子正方形（按屏宽算边长） */
.exp-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); grid-auto-rows: calc((100vw - 76px) / 3); gap: 8px; }
.exp-grid__big { position: relative; grid-column: span 2; grid-row: span 2; border-radius: 16px; overflow: hidden; background: var(--k-paper2); }
.exp-grid__add { border: 1px dashed var(--k-line2); background: var(--k-bg); box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; }
.exp-grid__cell { position: relative; border-radius: 12px; background: var(--k-paper2); }
.exp-grid__img { width: 100%; height: 100%; border-radius: inherit; }
.exp-grid__pen { position: absolute; right: 10px; bottom: 10px; }
.exp-grid--filled { grid-template-columns:1.8fr repeat(3,minmax(0,1fr));grid-auto-rows:calc((100vw - 84px) / 4.8);gap:8px; }
.exp-grid--filled .exp-grid__big { grid-column:span 1;grid-row:span 2; }
.exp-grid__plus { border: 1.5px dashed var(--k-red-line); background: var(--k-red-soft); box-sizing: border-box; display: flex; align-items: center; justify-content: center; }
.exp-grid__count { border: 1.5px dashed var(--k-line2); background: #FBF6EF; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; font-size: 12px; color: var(--k-muted); }
/* 其余的图每行 4 个，最后一格是橙色渐变「+」 */
.uploads { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
.upload-item, .upload-add { position: relative; width: calc((100% - 24px) / 4); height: 72px; border-radius: 12px; overflow: visible; flex: 0 0 auto; }
.upload-img { width: 100%; height: 72px; border-radius: 12px; }
.upload-close { position: absolute; right: -3px; top: -4px; width: 20px; height: 20px; border-radius: 50%; background: rgba(36,27,23,.78); display: flex; align-items: center; justify-content: center; }
.upload-duration { position: absolute; right: 5px; bottom: 3px; color: #fff; font-size: 11px; font-weight: 600; text-shadow: 0 1px 2px rgba(0,0,0,.8); }
.upload-add { background: var(--k-red-soft); display: flex; align-items: center; justify-content: center; }
/* 标题 / 正文：粗体标签 + 右边计数，下面是不描边的输入框，中间一道分隔线 */
.field-block { margin-top: 14px; }
.field-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 4px; }
.field-label { font-size: 18px; font-weight: 600; color: var(--k-ink); }
.counter { color: var(--k-muted); font-size: 12px; }
.text-field { height: 46px; display: flex; align-items: center; }
.text-field input { width: 100%; height: 44px; font-size: 17px; font-weight: 500; color: var(--k-ink); }
.compose__line { height: 1px; margin-top: 4px; background: var(--k-line); }
.body-field-block { margin-top: 12px; }
/* 正文最多 500 字：输入框 6 行高，写长一点也看得到前文 */
.textarea-field { position: relative; padding: 4px 0 8px; }
.textarea-field textarea { width: 100%; height: 132px; font-size: 15px; line-height: 1.6; }
/* 不打字时的替身：和 textarea 一样大，长文只做预览不撑开；空着时显示提示字 */
.textarea-field .publish-area-idle { width: 100%; height: 132px; font-size: 15px; line-height: 1.6; overflow: hidden; white-space: pre-wrap; word-break: break-all; color: var(--k-ink); }
.publish-area-ph { color: var(--k-light); }
/* 「关联帖子」「补充信息」：浅米色底的可展开卡 */
.fold { margin-top: 12px; padding: 14px; border-radius: 16px; background: var(--k-paper); }
.fold__head { display: flex; align-items: center; gap: 10px; min-height: 48px; }
.fold__icon { flex: 0 0 auto; width: 24px; display: flex; align-items: center; justify-content: center; }
.fold__copy { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 2px; }
.fold__title { font-size: 15px; font-weight: 600; color: var(--k-ink); }
.fold__action { font-size: 13px; color: var(--k-red-deep); }
.fold__opt { font-size: 13px; font-weight: 400; color: var(--k-muted); }
.fold__sub { font-size: 13px; line-height: 1.6; color: var(--k-muted); }
.fold__note { display: block; margin-top: 8px; font-size: 12px; line-height: 1.5; color: var(--k-ink2); }
.fold__body { margin-top: 6px; padding: 0; }
/* 「补充信息」是灰色折叠条（样稿），和上面浅暖色的「关联帖子」分开层次 */
.fold.extra { background: var(--k-paper2); }
/* 已关联的对象：小封面 + 标题 + 类型小标签 + 右边「已关联 / 不关联」 */
.link-pick { margin-top: 12px; padding-top: 14px; border-top: 1px solid var(--k-line); }
.link-pick__row { display: flex; align-items: center; gap: 10px; }
.link-pick__note { display: block; margin-top: 10px; padding-top: 9px; border-top: 1px solid var(--k-line); font-size: 12px; line-height: 1.6; color: var(--k-muted); }
.link-pick__img { flex: 0 0 auto; width: 52px; height: 52px; border-radius: 10px; background: var(--k-paper2); }
.link-pick__img--empty { display: flex; align-items: center; justify-content: center; background: var(--k-red-soft); }
.link-pick__copy { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 5px; }
.link-pick__title { font-size: 14px; font-family: var(--k-display-font); font-weight: 700; line-height: 1.4; color: var(--k-ink); display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; word-break: break-all; }
.link-pick__tags { display: flex; align-items: center; gap: 6px; min-width: 0; }
.link-tag { flex: 0 0 auto; height: 20px; padding: 0 7px; border-radius: 6px; background: var(--k-red-soft); color: var(--k-red-deep); font-size: 11px; font-weight: 600; line-height: 20px; }
.link-pick__city { min-width: 0; font-size: 12px; color: var(--k-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.link-pick__side { flex: 0 0 auto; display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
.link-pick__on { font-size: 12px; font-weight: 700; color: var(--k-green); }
.link-pick__x { min-height: 44px; padding: 0 2px 0 8px; display: flex; align-items: center; font-size: 12px; color: var(--k-muted); }
/* 补充信息里的一行行选项 */
.publish-row { height: 48px; border-bottom: 1px solid var(--k-line); display: flex; align-items: center; font-size: 15px; font-weight: 500; }
.publish-row:last-child { border-bottom: 0; }
/* 长城市名之前把左边的字段名挤成两行；现在右侧单行省略 */
.publish-row > text, .activity-row > text { flex-shrink: 0; }
.publish-row__right { min-width: 0; margin-left: auto; padding-left: 12px; display: flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 500; }
.publish-row__right > text, .activity-row__right > text { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.optional { margin-left: 4px; font-size: 12px; color: var(--k-muted); font-weight: 400; }
.muted { color: var(--k-muted); }
/* 2026-11-03 主人：简化；同行性别 / 伙伴说沿用页面内按钮组，选中使用橙棕描边浅底 */
.publish-opt { padding: 10px 0 12px; border-bottom: 1px solid var(--k-line); }
.publish-opt:last-child { border-bottom: 0; }
.publish-opt__head { display: flex; align-items: center; min-height: 28px; font-size: 15px; font-weight: 500; }
.opt-pills { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px; }
.opt-pill { min-height: 44px; padding: 0 14px; border: 1px solid transparent; border-radius: 18px; background: var(--k-paper); color: var(--k-ink2); font-size: 14px; display: flex; align-items: center; }
.opt-pill.on { border-color: #C9935F; background: #F6EBDD; color: #8A5A30; font-weight: 600; }
/* 「查看已提交的内容和审核进度 · 我的发布 ›」 */
.publish-history { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 10px; color: var(--k-muted); font-size: 12px; }
.publish-history button { margin: 0; padding: 0; height: 44px; line-height: 44px; display: flex; align-items: center; color: var(--k-red); background: transparent; font-size: 14px; flex-shrink: 0; }
.publish-history button::after { border: 0; }
.publish-history__hint { min-width: 0; flex: 1; line-height: 1.45; }
/* 底部固定条：左「存草稿」描边胶囊，右「发布」暖棕渐变大胶囊 */
.pbar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 50; background: var(--k-paper); border-top: 1px solid var(--k-line); }
.pbar__row { height: 64px; padding: 0 16px; display: flex; align-items: center; gap: 12px; }
.pbar__safe { height: var(--k-safe-bottom); }
.pbar__draft { flex: 0 0 auto; width: 34%; height: 48px; border: 1px solid var(--k-line2); border-radius: 14px; background: var(--k-paper); color: var(--k-red-deep); font-size: 15px; display: flex; align-items: center; justify-content: center; }
.pbar__go { min-width: 0; flex: 1; height: 48px; border-radius: 14px; background: var(--k-red); color: var(--k-paper); font-size: 16px; font-weight: 600; display: flex; align-items: center; justify-content: center; }
.dual-buttons { display: flex; gap: 12px; margin-top: 13px; }
.dual-button { min-width: 0; flex: 1; }
.verify-body { padding: 22px 24px calc(92px + var(--k-safe-bottom)); text-align: center; }
.verify-art { display: flex; align-items: center; justify-content: center; width: 180px; height: 135px; margin: 8px auto 6px; }
.verify-art__phone { position: relative; width: 92px; height: 92px; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: var(--k-paper2); }
.verify-art__badge { position: absolute; right: 7px; bottom: 13px; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; border: 3px solid var(--k-bg); border-radius: 50%; background: var(--k-green); }
.verify-lead { display: block; font-family: var(--k-sans); font-size: 16px; line-height: 1.7; }
.verify-title { display: block; font-family: var(--k-serif); font-size: 18px; font-weight: 700; line-height: 1.6; }
.verify-info { margin-top: 18px; padding: 14px 16px; border-radius: 12px; background: var(--k-paper); box-shadow: var(--k-sh1); text-align: left; }
.verify-info__row { display: flex; align-items: flex-start; gap: 9px; }
.verify-info__row + .verify-info__row { margin-top: 12px; }
.verify-info__title { display: block; font-family: var(--k-serif); font-size: 14px; font-weight: 700; }
.verify-info__text { display: block; margin-top: 3px; color: var(--k-muted); font-size: 12px; line-height: 1.55; white-space: pre-line; }
.phone-wrap { margin-top: 17px; text-align: left; }
.phone-label { display: block; margin-bottom: 6px; font-size: 13px; color: var(--k-muted); }
.phone-field { height: 42px; padding: 0 12px; border: 1px solid var(--k-line2); border-radius: 8px; background: var(--k-paper); display: flex; align-items: center; justify-content: space-between; }
.phone-number { font-size: 16px; font-weight: 600; letter-spacing: .5px; }
.phone-authorize { display: flex; align-items: center; gap: 6px; color: var(--k-muted); font-size: 12px; }
.change-account { display: block; margin: 8px 0 10px 2px; color: var(--k-indigo); font-size: 12px; }
.verify-foot { display: block; margin-top: 10px; color: var(--k-light); font-size: 12px; letter-spacing: .5px; }
.experience-body { padding: 10px 16px calc(92px + var(--k-safe-bottom)); }
.experience-tip { min-height: 68px; padding: 12px 16px; border-radius: 12px; background: var(--k-paper); box-shadow: var(--k-sh1); display: flex; align-items: center; justify-content: space-between; }
.experience-tip__title { display: block; font-family: var(--k-serif); font-size: 14px; font-weight: 700; }
.experience-tip__sub { display: block; margin-top: 6px; color: var(--k-muted); font-size: 12px; }
.experience-head { margin: 14px 0 8px; }
.experience-link { color: var(--k-muted); font-size: 12px; }
.experience-card { min-height: 74px; padding: 8px; border-radius: 12px; background: var(--k-paper); box-shadow: var(--k-sh1); display: flex; align-items: center; gap: 10px; }
.experience-card + .experience-card { margin-top: 8px; }
.experience-img { width: 68px; height: 62px; border-radius: 7px; flex: 0 0 auto; }
.experience-copy { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 4px; }
/* 标题最多两行；类型、已完成的小标签另起一行 */
.experience-name { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; font-family: var(--k-serif); font-size: 14px; font-weight: 700; line-height: 1.4; word-break: break-all; }
.experience-tags { display: flex; flex-wrap: wrap; gap: 6px; }
.done { padding: 2px 5px; border-radius: 4px; background: var(--k-green-soft); color: var(--k-green); font-size: 10px; flex: 0 0 auto; }
.done.done--ongoing { background: var(--k-ochre-soft); color: #8B622E; }
/* 暂时还不能用的报名：奶油底、不能选，原因写在下面 */
.experience-off-head { display: block; margin: 16px 0 8px; font-size: 14px; font-weight: 600; color: var(--k-ink2); }
.experience-card.experience-card--off { min-height: 0; padding: 10px 12px; background: var(--k-paper2); box-shadow: none; align-items: flex-start; }
.experience-off-icon { width: 34px; height: 34px; border-radius: 50%; background: var(--k-paper); display: flex; align-items: center; justify-content: center; flex: 0 0 auto; }
.experience-card--off .experience-name { color: var(--k-ink2); }
.experience-reason { font-size: 12px; color: var(--k-ink2); line-height: 1.45; }
.experience-rule { display: flex; align-items: flex-start; gap: 5px; margin: 14px 0 12px; color: var(--k-ink2); font-size: 12px; line-height: 1.5; }
/* 经历类型：换宿旅行 / 线下兼职 / 全职 */
.exp-type { padding: 2px 5px; border-radius: 4px; background: var(--k-paper2); color: var(--k-ink2); font-size: 10px; flex: 0 0 auto; }
.experience-meta { color: var(--k-muted); font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
/* 完成时间要看全：放不下就在日期中间折行，不再省略成「2026.0…」 */
.experience-meta.experience-date { white-space: normal; overflow: visible; }
/* 320 宽：封面小一点、间距收窄，给文字多留位置 */
@media (max-width: 359px) {
  .experience-card { gap: 8px; }
  .experience-img { width: 56px; height: 56px; }
}
.radio { width: 22px; height: 22px; border: 1.5px solid var(--k-light); border-radius: 50%; display: flex; align-items: center; justify-content: center; flex: 0 0 auto; }
.radio.selected { border-color: var(--k-red); }
.radio__dot { width: 12px; height: 12px; border-radius: 50%; background: var(--k-red); }
.empty-experience { margin: 14px 0; padding: 13px 16px; border-radius: 12px; background: var(--k-paper); box-shadow: var(--k-sh1); }
.empty-experience__title { display: block; font-family: var(--k-serif); font-size: 15px; font-weight: 700; }
.empty-experience__sub { display: block; margin: 5px 0 10px; color: var(--k-muted); font-size: 12px; }
.sync-body { padding: 10px 16px calc(92px + var(--k-safe-bottom)); }
.sync-switch-row { padding: 12px 14px; border-radius: 12px; background: var(--k-paper); box-shadow: var(--k-sh1); display: flex; align-items: center; justify-content: space-between; }
.sync-switch-title { display: block; font-family: var(--k-serif); font-size: 15px; font-weight: 700; }
.sync-switch-sub { display: block; margin-top: 5px; color: var(--k-muted); font-size: 11px; }
.switch { width: 46px; height: 27px; padding: 2px; border-radius: 16px; background: #BDB8AF; box-sizing: border-box; transition: background .15s; }
.switch.on { background: var(--k-green); }
.switch__knob { width: 23px; height: 23px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.2); transition: transform .15s; }
.switch.on .switch__knob { transform: translateX(19px); }
.activity-title-row { justify-content: flex-start; gap: 8px; margin: 16px 0 8px; }
.activity-info { padding: 0 12px; border-radius: 12px; background: var(--k-paper); box-shadow: var(--k-sh1); }
.activity-row { height: 44px; border-bottom: 1px solid var(--k-line); display: flex; align-items: center; font-size: 14px; font-weight: 500; }
.activity-row:last-child { border-bottom: 0; }
.activity-row__right { min-width: 0; margin-left: auto; padding-left: 12px; display: flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 500; }
.round-op { width: 25px; height: 25px; border: 1px solid var(--k-line2); border-radius: 50%; background: #fff; display: flex; align-items: center; justify-content: center; }
.people { min-width: 36px; text-align: center; }
.preview-label { display: block; margin: 17px 0 8px; font-family: var(--k-serif); font-size: 17px; font-weight: 700; }
.preview-card { height: 133px; padding: 8px; border-radius: 12px; background: var(--k-paper); box-shadow: var(--k-sh1); display: flex; gap: 10px; box-sizing: border-box; }
.preview-img { width: 88px; height: 115px; border-radius: 7px; flex: 0 0 auto; }
.preview-copy { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 5px; }
.preview-chip { align-self: flex-start; padding: 2px 6px; border-radius: 4px; background: var(--k-ochre-soft); color: #8B622E; font-size: 10px; }
.preview-title { font-family: var(--k-serif); font-size: 14px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.preview-meta { display: flex; align-items: center; gap: 4px; color: var(--k-muted); font-size: 10px; white-space: nowrap; overflow: hidden; }
.preview-meta text { overflow: hidden; text-overflow: ellipsis; }
.preview-sign { margin-top: auto; display: flex; align-items: center; gap: 8px; color: var(--k-muted); font-size: 11px; }
.avatar-stack { display: flex; }
.preview-avatar { width: 23px; height: 23px; border-radius: 50%; border: 1.5px solid var(--k-paper); margin-left: -6px; }
.preview-avatar:first-child { margin-left: 0; }
.sync-buttons { margin-top: 11px; }
.publish-page .compose,.publish-page .sync-switch-row,.publish-page .activity-info,.publish-page .preview-card,.publish-page .verify-info,.publish-page .experience-tip,.publish-page .experience-card { border-radius:18px;box-shadow:0 4px 14px rgba(94,70,39,.055);background:#FFFEFC; }
.publish-page .pbar__draft,.publish-page .pbar__go { border-radius:999px; }
.publish-page .pbar__go { background:linear-gradient(120deg,#C49357,#A06D35);box-shadow:0 3px 9px rgba(136,93,43,.12); }
.publish-page .activity-title-row .k-title,.publish-page .preview-label { font-family:var(--k-sans);font-size:18px; }
.publish-page .sync-switch-title,.publish-page .experience-tip__title { font-family:var(--k-sans);font-size:16px; }
.publish-page .activity-info { padding:4px 14px; }
.publish-page .activity-row { min-height:48px; }
.publish-page .preview-card { height:144px;padding:10px;gap:12px; }
.publish-page .preview-img { height:124px;border-radius:11px; }
.publish-page .verify-info { padding:18px; }
.publish-page .experience-card { padding:10px;gap:12px; }
.publish-page .experience-name { font-family:var(--k-sans);font-size:15px; }
</style>

<style lang="scss">
/* 标题 / 正文的提示字：小程序里 placeholder 不带 scoped 的 data-v 类，写在 scoped 里不生效，单独放这里（类名带页面前缀，H5 里也不会串到别的页面） */
.publish-ph { color: #A39A92; font-weight: 400; }
</style>
