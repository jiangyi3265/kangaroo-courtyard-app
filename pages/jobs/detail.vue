<template>
  <k-feature-gate feature="recruitment">
  <!-- 2026-10-18 主人：去掉顶上「岗位信息 / 评价」两个页签（连同整页左右滑切页签），评价放进页面里「用户反馈」那一块 -->
  <view class="k-page detail-page" :class="{ 'detail-page--volunteer': isVolunteer, 'detail-page--parttime': pt }" :style="isVolunteer || pt ? { '--detail-weave': 'url(' + DETAIL_ART.paper + ')' } : {}">
    <k-topbar :title="isOnline ? '线上任务详情' : '岗位详情'" :bg="isVolunteer ? '#FFF9FA' : ''" back custom-back @back="back" />

    <view class="overview k-pad-bottom">
      <k-job-urgency :job="detail" expanded />
      <!-- 线上任务：照旧是这一套（照片图集 → 标题 / 标签 / 收藏 → 关键信息 → 线上任务须知 → 工作内容 → 我们希望你 → 门店卡片） -->
      <template v-if="isOnline">
        <!-- 岗位照片（V49，门店传的最多 9 张）：可以左右滑、点开看大图；没传照片时就是封面一张（岗位封面 / 门店封面）。
             门店已通过安心商家认证、并且岗位含保险：左上角挂「经袋鼠实地拍摄并含保险」（和列表卡片同一个角标，线上任务没有） -->
        <view class="hero"><swiper class="hero__swiper" :circular="gallery.length > 1" :current="heroIndex" @change="onHeroChange"><swiper-item v-for="(img, i) in gallery" :key="img + i"><image class="hero__img" :src="img" mode="aspectFill" @click="previewHero(i)" /></swiper-item></swiper><view v-if="assured" class="hero__badge"><job-badge size="hero" /></view><text v-if="gallery.length > 1" class="hero__count">{{ heroIndex + 1 }}/{{ gallery.length }}</text></view>
        <view class="overview-body">
          <view class="overview-title"><text>{{ displayWording(title, [storeInfo?.storeName]) }}</text><k-chip v-if="blockedShort || headcountText" :tone="blockedShort ? 'neutral' : 'green'"><text>{{ blockedShort || headcountText }}</text></k-chip></view>
          <!-- 换工类型（门店发布时选的，如「摄影换工」）；门店勾了「做满一个月有红包」（V44）时旁边加「满月红包」 -->
          <view v-if="kindLabel || redpacket" class="overview-kind"><k-chip v-if="kindLabel" tone="ochre" icon="tag"><text>{{ kindLabel }}</text></k-chip><view v-if="redpacket" class="redpacket-tag"><text>满月红包</text></view></view>
          <view class="overview-flags"><view v-if="safeText && !assured" class="safe"><k-icon name="shield-check" :size="16" color="green" /><text>{{ safeText }}</text></view><view class="favorite" :class="{ 'is-busy': favoriteBusy }" role="button" :aria-label="favorite ? '取消收藏岗位' : '收藏岗位'" :aria-disabled="favoriteBusy" :aria-pressed="favorite" @click.stop="toggleFavorite"><k-icon name="star" :size="23" :color="favorite ? 'ochre' : 'muted'" :fill="favorite" /><text>{{ favorite ? '已收藏' : '收藏' }}</text></view></view>
          <view v-if="applyBlockedText" class="blocked-tip"><k-icon name="info" :size="17" color="alert" /><text>{{ applyBlockedText }}</text></view>
          <!-- 关键信息：之前「职位概览」「工作与权益」两页各写一遍，合成一张。工作地点有地图坐标（门店发布时在地图上选过点）时整行可点，打开地图看位置、导航 -->
          <view class="info-card"><view v-for="item in overviewRows" :key="item.label" class="info-row" :class="{ 'info-row--tap': item.tap }" @click="tapRow(item)"><k-icon :name="item.icon" :size="19" color="ink" /><text class="info-row__label">{{ item.label }}</text><text class="info-row__value">{{ item.value }}</text><text v-if="item.tap" class="info-row__map">{{ mapTag }}</text><k-icon v-if="item.tap" name="chevron-right" :size="16" color="muted" /></view></view>
          <!-- 线上任务：报名前先看看从接单到结算怎么走（后台「小程序公告」里固定标识 online-guide 那一条） -->
          <view v-if="isOnline" class="guide-link" hover-class="k-press" @click="openOnlineGuide"><k-icon name="book-open" :size="18" color="red" /><text class="guide-link__title">线上任务须知</text><text class="guide-link__sub">接单、交成果到结算怎么走</text><k-icon name="chevron-right" :size="16" color="muted" /></view>
          <view class="plain-card"><text class="plain-card__title">具体工作内容</text><text class="plain-card__list">{{ contentText || '门店暂未填写，报名前可以和店主确认' }}</text></view>
          <view class="plain-card"><text class="plain-card__title">我们希望你</text><text class="plain-card__list">{{ requirementText || '门店暂未填写' }}</text></view>
          <!-- 奖金、提成、结算方式：门店写了才有这一张 -->
          <view v-if="payRows.length" class="section-card"><text class="section-card__title">奖金与结算</text><view v-for="item in payRows" :key="item.label" class="section-row"><k-icon :name="item.icon" :size="18" color="ink" /><text class="section-row__label">{{ item.label }}</text><text class="section-row__value">{{ item.value }}</text></view></view>
          <!-- 门店：点「关注」后这家店发布新岗位会在消息中心通知你；点门店名看这家店在招的其他岗位 -->
          <view v-if="storeInfo.storeId" class="store-card">
            <image v-if="storeInfo.cover" class="store-card__cover" :src="storeCover" mode="aspectFill" @click="openStoreJobs" />
            <view class="store-card__main" @click="openStoreJobs"><text class="store-card__name">{{ storeInfo.storeName }}</text><text class="store-card__meta">{{ storeMeta }}</text></view>
            <k-button size="xs" :type="following ? 'outline' : 'secondary'" :icon="following ? 'check' : 'plus'" :label="following ? '已关注' : '关注'" :disabled="followBusy" @click="toggleFollow" />
          </view>
        </view>
      </template>
      <!-- 线下岗位（换宿旅行 / 兼职 / 全职）：2026-10-18 改版成「门店页」（主人效果图 41），10-19 按参考图「岗位详情」一比一还原视觉（暖米底、细暖边白卡、深棕页签头、彩色立体亮点图标）。
           换宿旅行（版式 1）：头图 → 标题 + 收藏 → 一行标签 → 位置与交通 → 采访视频 → 换工要求 → 招募信息三栏 → 工作内容 + 工作时间 → 福利 → 店长介绍 → 该店亮点
           → 用户反馈 + 店里日常（两卡并排）→ 袋鼠安心保障 → 门店卡片。
           兼职 / 全职（版式 1b，主人：「兼职旅行的全职旅行的也差不多这么修改」）：头图三张并排 + 底部白字采访说明 → 标题 / 岗位类型｜城市 / 状态胶囊 → 安心商家 + 收藏
           → 招募信息表（内嵌位置与交通）→ 采访视频 → 岗位招募要求（工作内容 | 排班与工时）→ 岗位要求 → 工作待遇（深棕标题头）→ 后面同版式 1。
           门店资料来自详情接口的 storePage。换宿详情固定保留完整原稿结构，未上传的资料显示同尺寸待补充状态；资料补齐后自动替换。 -->
      <parttime-detail v-else-if="pt" :model="parttimeModel"
        @preview-hero="previewHero" @favorite="toggleFavorite" @map="openMap"
        @interview="playInterview" @close-video="closeVideo" @preview-daily="previewDaily" @daily="openDaily" @reviews="openStoreReviews"
        @write-review="writeReview" @assurance="tapAssurance" @store="openStoreJobs" @follow="toggleFollow" @training="openTraining">
        <template #subscription><job-city-subscribe ref="subscriptionRef" :city="detail.city || storeInfo.city || ''" /></template>
      </parttime-detail>
      <view v-else-if="detail" class="sp" :data-interview-mode="mode">
        <!-- 1 头图随真实照片数量排版：单图完整展示，多图使用拼图，不补空格。
             兼职 / 全职：左大、中、右小三张并排，底部一条白字「袋鼠线下实地探访｜含意外险」代替角标 -->
        <view class="sp-hero" :class="{ 'sp-hero--grid': heroGrid.grid.length, 'sp-hero--trio': pt }">
          <view class="sp-hero__main" @click="heroGrid.main && previewHero(0)"><image v-if="heroGrid.main" class="sp-hero__img" :src="heroGrid.main" mode="aspectFill" /><view v-else class="sp-photo-empty"><k-icon name="image" :size="28" color="#A4917E" :stroke="1.3" /><text>门店照片待补充</text></view></view>
          <view v-if="heroGrid.grid.length" class="sp-hero__grid" :class="'sp-hero__grid--' + heroGrid.grid.length">
            <view v-for="cell in heroGrid.grid" :key="cell.index" class="sp-hero__cell" :class="{ 'sp-hero__cell--wide': heroGrid.grid.length === 3 && cell.index === 3 }" @click="cell.src && previewHero(cell.index)"><image v-if="cell.src" class="sp-hero__img" :src="cell.src" mode="aspectFill" /><view v-else class="sp-photo-empty"><k-icon name="image" :size="19" color="#A4917E" :stroke="1.3" /><text>待补充</text></view><view v-if="heroGrid.more && cell.index === heroGrid.grid.length" class="sp-hero__more"><text>+{{ heroGrid.more }}</text></view></view>
          </view>
          <view v-if="badgeVariant && !pt" class="sp-hero__badge"><text v-if="isVolunteer" class="sp-visit-label">{{ volunteerVisitLabel }}</text><job-badge v-else size="detail" :variant="badgeVariant" /></view>
          <view v-if="pt && heroCaption" class="sp-hero__caption"><text>{{ heroCaption }}</text></view>
          <view v-if="images.length && !heroGrid.more" class="sp-hero__count" @click="previewHero(0)">共 {{ images.length }} 张 · 查看照片</view>
          <view class="sp-hero__tr">
            <view class="sp-hero__check"><k-icon v-if="!isVolunteer" name="badge-check" :size="12" color="white" :stroke="2" /><text>平台岗检</text></view>
          </view>
        </view>
        <view class="sp-body">
          <!-- 订阅放在标题右侧；收藏保留在下方标签行。 -->
          <view class="sp-heading">
            <view v-if="!pt" class="sp-title"><text class="sp-title__text k-display">{{ displayWording(title, [storeInfo.storeName]) || storeInfo.storeName }}</text></view>
            <view v-else class="sp-pthead">
              <view class="sp-pthead__main"><text class="sp-title__text k-display">{{ displayWording(title, [storeInfo?.storeName]) }}</text><text v-if="ptSubline" class="sp-pthead__sub">{{ ptSubline }}</text></view>
              <text v-if="blockedShort || headcountText" class="sp-pthead__state" :class="{ 'sp-pthead__state--off': !!blockedShort }">{{ blockedShort || headcountText }}</text>
            </view>
            <view class="sp-heading__subscribe"><job-city-subscribe ref="subscriptionRef" :city="detail.city || storeInfo.city || ''" /></view>
          </view>
          <!-- 3 一行标签：换工类型 | 食宿（+奖金）| 还招 N 人（不能报名时写短原因） -->
          <view class="sp-tagline">
            <view v-if="!pt && displayTags.length" class="sp-tags"><view class="sp-tags__icon"><k-icon name="check" :size="10" color="white" :stroke="3.4" /></view><text v-for="(part, pi) in displayTags" :key="part + pi" class="sp-tags__item" :class="{ 'sp-tags__item--sep': pi > 0, 'sp-tags__item--muted': !!blockedShort && pi === displayTags.length - 1 }">{{ part }}</text></view>
            <view class="sp-heading__favorite" :class="{ on: favorite, 'is-busy': favoriteBusy }" role="button" :aria-disabled="favoriteBusy" :aria-pressed="favorite" :aria-label="favorite ? '取消收藏岗位' : '收藏岗位'" hover-class="k-press-s" @click.stop="toggleFavorite"><image v-if="isVolunteer && !favorite" class="sp-favorite-art" :src="DETAIL_ART.star" mode="aspectFit" /><k-icon v-else name="star" :size="21" color="#94683F" :fill="favorite" :stroke="1.6" /></view>
          </view>
          <view v-if="pt" class="sp-ptflags">
            <view v-if="safeCertified" class="sp-safe"><view class="sp-safe__tick"><k-icon name="check" :size="12" color="white" :stroke="3" /></view><text>安心商家</text></view>
          </view>
          <view v-if="applyBlockedText" class="blocked-tip"><k-icon name="info" :size="17" color="alert" /><text>{{ applyBlockedText }}</text></view>
          <!-- 兼职 / 全职：「招募信息」表（招募人数 | 最短服务期；预计到岗），下面接位置与交通 -->
          <view v-if="pt && (ptStats.length || placeText || mapPoint || sections.travel.rows.length)" class="sp-card sp-recruit">
            <view v-if="ptStats.length" class="sp-recruit__head"><text class="sp-h k-display">招募信息</text></view>
            <view v-if="ptStats.length" class="sp-recruit__table" :class="'sp-recruit__table--' + ptCols"><view v-for="pst in ptStats" :key="pst.k" class="sp-recruit__cell"><text class="sp-recruit__k">{{ pst.k }}</text><text class="sp-recruit__v">{{ pst.v }}</text></view></view>
            <view v-if="placeText || mapPoint || sections.travel.rows.length" class="sp-loc" :class="{ 'sp-loc--inner': ptStats.length }">
              <view class="sp-loc__copy" role="button" aria-label="打开门店地图" @click="openMap"><text class="sp-h k-display">位置与交通</text><text v-if="placeText" class="sp-loc__addr">{{ placeText }}</text></view>
              <view v-if="mapPoint || placeText" class="sp-map" hover-class="k-press-s" @click="openMap"><image v-if="isVolunteer" class="sp-map__art" :src="DETAIL_ART.map" mode="aspectFill" /><view class="sp-map__road sp-map__road--a" /><view class="sp-map__road sp-map__road--b" /><view class="sp-map__ring" /><view class="sp-map__pin"><view class="sp-map__pin-dot" /></view><text class="sp-map__tag">{{ mapTag }}</text></view>
            </view>
            <view v-if="sections.travel.rows.length" class="sp-trip"><view v-for="row in sections.travel.rows" :key="row.k" class="sp-bullet"><text class="sp-bullet__dot">·</text><text class="sp-bullet__text"><text class="sp-bullet__k">{{ row.k }}：</text>{{ row.v }}</text></view><text class="sp-note">{{ TRAVEL_NOTE }}</text></view>
          </view>
          <!-- 4 位置与交通（版式 1）：地址 · 城市；有坐标时右边一块小地图，点了打开地图（网页版复制地址）；交通参考（高铁 / 机场）填了才有 -->
          <view v-if="!pt && (placeText || mapPoint || sections.travel.rows.length)" class="sp-card sp-location" :class="{ 'sp-location--collapsed': travelCanExpand && !travelExpanded }">
            <view class="sp-loc">
              <view class="sp-loc__copy" role="button" aria-label="打开门店地图" @click="openMap"><text class="sp-h k-display">位置与交通</text><text v-if="placeText || isVolunteer" class="sp-loc__addr">{{ placeText || '门店地址待补充' }}</text></view>
              <view v-if="mapPoint || isVolunteer" class="sp-map" :class="{ 'sp-map--pending': !mapPoint }" hover-class="k-press-s" @click="openMap"><image v-if="isVolunteer" class="sp-map__art" :src="DETAIL_ART.map" mode="aspectFill" /><view class="sp-map__road sp-map__road--a" /><view class="sp-map__road sp-map__road--b" /><view class="sp-map__ring" /><view class="sp-map__pin"><view class="sp-map__pin-dot" /></view><text class="sp-map__tag">{{ mapPoint ? mapTag : placeText ? '搜索地址' : '位置待补充' }}</text></view>
            </view>
            <view v-if="sections.travel.rows.length">
              <view class="sp-location__head"><text class="sp-sub k-display">交通参考</text><view v-if="travelCanExpand" class="sp-location__toggle" role="button" :aria-label="travelExpanded ? '收起交通详情' : '查看完整地址与交通'" :aria-expanded="travelExpanded" hover-class="k-press-s" @click="travelExpanded = !travelExpanded"><text>{{ travelExpanded ? '收起详情' : '展开详情' }}</text><k-icon :name="travelExpanded ? 'chevron-up' : 'chevron-down'" :size="14" color="#94683F" /></view></view>
              <view class="sp-trip"><view v-for="row in sections.travel.rows" :key="row.k" class="sp-bullet"><text class="sp-bullet__dot">·</text><text class="sp-bullet__text"><text class="sp-bullet__k">{{ row.k }}：</text>{{ row.v }}</text></view><text v-if="isVolunteer" class="sp-note">{{ TRAVEL_NOTE }}</text></view>
              <text v-if="!isVolunteer" class="sp-note">{{ TRAVEL_NOTE }}</text>
            </view>
            <view v-else-if="placeText && travelCanExpand" class="sp-location__toggle" role="button" :aria-label="travelExpanded ? '收起完整地址' : '查看完整地址'" :aria-expanded="travelExpanded" hover-class="k-press-s" @click="travelExpanded = !travelExpanded"><text>{{ travelExpanded ? '收起地址' : '查看完整地址' }}</text><k-icon :name="travelExpanded ? 'chevron-up' : 'chevron-down'" :size="14" color="#94683F" /></view>
          </view>
          <!-- 5 视频未上传也保留封面框、标题、播放位、说明与状态条；有视频后接原有全屏播放。 -->
          <view v-if="isVolunteer || interview" class="sp-video" :class="{ 'sp-video--pending': !interview }">
            <view class="sp-video__cover" :hover-class="interview && !playing.url ? 'k-press-s' : 'none'" :role="interview ? 'group' : 'img'" :aria-label="interview ? videoTitle : pendingInterview.title" @click="interview && !playing.url && playInterview()">
              <job-video-player v-if="playing.url" inline :src="playing.url" :poster="playing.cover" :title="playing.title" @close="closeVideo" />
              <template v-else>
              <image v-if="interviewCover || (isVolunteer && heroGrid.main)" class="sp-video__img" :src="interviewCover || heroGrid.main" mode="aspectFill" />
              <view class="sp-video__shade" />
              <view class="sp-video__title"><image v-if="isVolunteer" class="sp-video__mark" :src="DETAIL_ART.kangaroo" mode="aspectFit" /><k-icon v-else name="flame" :size="14" color="#F5B25C" fill :stroke="1.4" /><text>{{ videoTitle || pendingInterview.title }}</text></view>
              <view class="sp-video__play"><k-icon :name="interview ? 'play' : 'video'" :size="22" color="white" :fill="!!interview" /></view>
              <text class="sp-video__cap">{{ interview ? interview.caption : pendingInterview.caption }}</text>
              </template>
            </view>
            <view class="sp-video__chiprow"><view class="sp-video__chip"><text>{{ interview ? interview.chip : pendingInterview.chip }}</text></view></view>
          </view>
          <!-- 兼职 / 全职：「岗位招募要求」下两卡并排（岗位工作内容 | 排班与工时），只有一张时占满一行 -->
          <text v-if="pt && (sections.content.length || sections.work)" class="sp-section k-display">岗位招募要求</text>
          <view v-if="pt && (sections.content.length || sections.work)" class="sp-pair" :class="{ 'sp-pair--one': !(sections.content.length && sections.work) }">
            <view v-if="sections.content.length" class="sp-card sp-half"><text class="sp-h k-display">岗位工作内容</text><view v-for="(line, li) in sections.content" :key="li" class="sp-bullet"><text class="sp-bullet__dot">·</text><text class="sp-bullet__text">{{ line }}</text></view></view>
            <view v-if="sections.work" class="sp-card sp-half"><view class="sp-half__head"><k-icon name="clock-3" :size="16" color="#C9782E" :stroke="2" /><text class="sp-h k-display">排班与工时</text></view><view v-if="sections.work.rest" class="sp-bullet"><text class="sp-bullet__dot">·</text><text class="sp-bullet__text"><text class="sp-bullet__k">排班模式：</text>{{ sections.work.rest }}</text></view><view v-if="sections.work.hours" class="sp-bullet"><text class="sp-bullet__dot">·</text><text class="sp-bullet__text"><text class="sp-bullet__k">每日工作时长：</text>{{ sections.work.hours }}</text></view></view>
          </view>
          <!-- 6 换工要求（换宿旅行，写性别）/ 岗位要求（兼职、全职）：深棕页签头。
               所有要求两列横排，长内容在列内换行；标签加粗换色、不写冒号。 -->
          <view v-if="sections.requirements" class="sp-card sp-card--tint sp-requirements">
            <view class="sp-tab"><text>{{ sections.requirements.title }}</text></view>
            <view class="sp-reqs">
              <view v-for="(row, ri) in reqLayout" :key="ri" class="sp-bullet sp-req-cell"><text class="sp-bullet__dot">·</text><text class="sp-bullet__text"><text v-if="row.k" class="sp-bullet__k sp-req-k">{{ row.k }}</text>{{ row.v }}</text></view>
            </view>
          </view>
          <!-- 7 招募信息 | 到岗时间 | 最短期限。兼职 / 全职在上面的招募信息表里 -->
          <view v-if="!pt && sections.stats.length" class="sp-card sp-card--tint sp-stats">
            <view v-if="sections.stats.length" class="sp-stats__row"><view v-for="(st, sti) in sections.stats" :key="st.k" class="sp-stat" :class="{ 'sp-stat--sep': sti > 0 }"><text class="sp-stat__k">{{ st.k }}</text><text class="sp-stat__v">{{ st.v }}</text></view></view>
          </view>
          <!-- 8 工作内容 + 工作时间（每日时长、休息排班）；兼职 / 全职在上面的「岗位招募要求」里。
               2026-11-03 主人：「工作内容和时间改成相同的样式，文字都加粗不要有冒号」：工作时间也用深棕页签头，两边正文加粗；门店写的「前台：接待客人」拆成加粗标签 + 内容，不写冒号 -->
          <view v-if="!pt && (sections.content.length || sections.work)" class="sp-card sp-card--tint sp-work-card">
            <view class="sp-work">
              <view v-if="sections.content.length" class="sp-work__list"><view class="sp-tab"><text>工作内容</text></view><view v-for="(row, li) in workRows" :key="li" class="sp-bullet" :class="{ 'sp-bullet--lead': isVolunteer && li === 0 }"><text class="sp-bullet__dot">·</text><text class="sp-bullet__text"><text v-if="row.k" class="sp-bullet__k sp-req-k">{{ row.k }}</text>{{ row.v }}</text></view></view>
              <view v-if="sections.work" class="sp-work__time" :class="{ 'sp-work__time--full': !sections.content.length, 'sp-work__time--pending': isVolunteer && !work }"><view class="sp-tab sp-work__tab"><text>工作时间</text></view><text v-if="sections.work.hours" class="sp-work__hours">{{ sections.work.hours }}</text><view v-if="sections.work.mode" class="sp-work__rest"><image v-if="isVolunteer" class="sp-work__clock" :src="DETAIL_ART.clock" mode="aspectFit" /><k-icon v-else name="clock-3" :size="17" color="#8A5A30" :stroke="2" /><text>{{ sections.work.mode }}</text></view><text v-if="sections.work.note" class="sp-work__note">{{ sections.work.note }}</text></view>
            </view>
          </view>
          <!-- 9 福利：换宿 + 满月红包叫「做满一个月福利」，其余「福利待遇」，兼职 / 全职「工作待遇」（深棕标题头，大字对勾）；只写门店填了的，保险只在含保险时写 -->
          <view v-if="sections.welfare" class="sp-card sp-card--warm sp-welfare" :class="{ 'sp-welfare--pt': pt }">
            <view v-if="pt" class="sp-welfare__bar"><text>{{ sections.welfare.title }}</text></view>
            <text v-else class="sp-h k-display">{{ sections.welfare.title }}</text>
            <view v-if="isVolunteer" class="sp-welfare__columns">
              <view v-for="(column, ci) in sections.benefits" :key="ci" class="sp-welfare__column">
                <text class="sp-welfare__column-title">{{ column.title }}</text>
                <view v-for="item in column.items" :key="item" class="sp-bullet"><text class="sp-bullet__dot">·</text><text class="sp-bullet__text">{{ item.replace(/^(奖金|结算)：/, '') }}</text></view>
              </view>
            </view>
            <template v-else>
              <view v-if="sections.welfare.highlights.length" class="sp-perks"><view v-for="(hl, hi) in sections.welfare.highlights" :key="hi" class="sp-perk"><view v-if="pt" class="sp-perk__tick"><k-icon name="check" :size="11" color="white" :stroke="3.2" /></view><text>{{ hl }}</text></view></view>
              <view class="sp-welfare__items"><view v-for="(item, wi) in sections.welfare.items" :key="wi" class="sp-bullet"><text class="sp-bullet__dot">·</text><text class="sp-bullet__text">{{ item }}</text></view></view>
            </template>
          </view>
          <!-- 福利与店长介绍之间展示住宿素材；包住宿但未上传时保留明确提示。 -->
          <view v-if="lodgingInfo" class="sp-card sp-extra sp-lodging">
            <text class="sp-h k-display">住宿展示</text>
            <job-media-grid :images="lodgingInfo.images" :video="lodgingInfo.video" :cover="lodgingInfo.cover" title="住宿展示" layout="lodging" />
          </view>
          <view v-if="petInfo" class="sp-card sp-extra">
            <text class="sp-h k-display">店里的宠物</text>
            <text class="sp-extra__line">{{ petInfo.text }}</text>
            <job-media-grid v-if="petInfo.images.length" :images="petInfo.images" title="店里的宠物" />
          </view>
          <!-- 10 店长介绍：资料未填写仍保留头像、简介与评分位。 -->
          <view v-if="sections.manager" class="sp-card sp-manager">
            <text class="sp-h k-display">店长介绍</text>
            <view class="sp-mgr">
              <image v-if="managerAvatar" class="sp-mgr__avatar" :src="managerAvatar" mode="aspectFill" />
              <view v-else class="sp-mgr__avatar sp-mgr__avatar--empty"><k-icon name="user-round" :size="32" color="#AC9278" :stroke="1.3" /><text>头像待上传</text></view>
              <view class="sp-mgr__copy"><text class="sp-mgr__name k-display">{{ sections.manager.name ? '店长：' + sections.manager.name : '店长资料待补充' }}</text><text v-if="isVolunteer && !manager" class="sp-mgr__line">完善后可了解店长与工作生活安排</text><template v-else><text v-if="sections.manager.years" class="sp-mgr__line">在这里工作{{ sections.manager.years }}</text><text v-if="sections.manager.skills" class="sp-mgr__line">擅长：{{ sections.manager.skills }}</text><text v-if="sections.manager.quote" class="sp-mgr__line">店长说：{{ sections.manager.quote }}</text></template></view>
            </view>
            <view v-if="isVolunteer || sections.manager.ratingText" class="sp-mgr__rating"><k-icon name="star" :size="14" color="#C69C6F" :fill="!!sections.manager.ratingText" /><text>店长服务评分</text><text class="sp-mgr__score" :class="{ 'sp-mgr__score--pending': !sections.manager.ratingText }">{{ sections.manager.ratingText || '暂无评分' }}</text></view>
          </view>
          <!-- 11 该店亮点：参考图里的六个彩色立体小图标（从参考图裁的，放在 jobs 分包 static 里）；其余设施用线条图标 -->
          <view v-if="sections.facilities.length" class="sp-card sp-facilities">
            <text class="sp-h k-display">该店亮点</text>
            <view class="sp-fac" :class="{ 'sp-fac--row': pt && sections.facilities.length <= 6 }"><view v-for="fac in sections.facilities" :key="fac.code" class="sp-fac__item"><image v-if="FAC_IMG[fac.code]" class="sp-fac__img" :src="FAC_IMG[fac.code]" mode="aspectFit" /><k-icon v-else :name="fac.icon" :size="24" color="red" :stroke="1.7" /><text class="sp-fac__label">{{ fac.label }}</text></view></view>
          </view>
          <!-- 12 换宿始终为两张并排卡片；没有评价或日常照片时保留各自的展示位。 -->
          <view class="sp-pair sp-life" :class="{ 'sp-pair--one': !isVolunteer && (!feedbackShown || !daily.length) }">
            <!-- 用户反馈（2026-10-18：原来「评价」页签的内容搬进来）：这家店真实岗位评价的综合分 / 条数 + 前 3 条评价，点了看这家店全部评价；
                 在这家店做过、还没评过的人多一个「我在这家店做过，写评价」。 -->
            <view v-if="isVolunteer || digest.count || reviewAppId" class="sp-card sp-fbk" role="button" aria-label="查看用户反馈" hover-class="k-press-s" @click.stop="openStoreReviews">
              <view class="sp-fbk__head" hover-class="k-press" @click.stop="openStoreReviews">
                <text class="sp-h k-display">用户反馈</text>
                <k-icon v-if="isVolunteer" name="chevron-right" :size="14" color="#A38A75" />
                <view v-if="digest.count && !isVolunteer" class="sp-fbk__score"><text v-if="digest.avgText" class="sp-fbk__num">{{ digest.avgText }}</text><k-icon v-if="digest.avgText" name="star" :size="12" color="#E39A4E" fill /><text class="sp-fbk__meta">{{ digest.count }}条 ›</text></view>
              </view>
              <view v-for="rvItem in (isVolunteer ? digest.items.slice(0, 2) : digest.items)" :key="rvItem.key" class="sp-rv" hover-class="k-press-s" @click.stop="openStoreReviews">
                <text class="sp-bullet__dot">·</text>
                <view class="sp-rv__main">
                  <text class="sp-rv__text">{{ rvItem.text }}</text>
                  <view v-if="!isVolunteer" class="sp-rv__top"><text class="sp-rv__name">{{ rvItem.name }}</text><text v-if="rvItem.days" class="sp-rv__days">{{ rvItem.days }}</text><view v-if="rvItem.rating != null" class="sp-rv__stars"><k-icon v-for="n in 5" :key="n" name="star" :size="9" :color="n <= rvItem.stars ? '#E39A4E' : 'light'" :fill="n <= rvItem.stars" /></view></view>
                </view>
              </view>
              <view v-if="isVolunteer && !digest.count" class="sp-fbk__empty"><text>暂无伙伴评价</text><text>期待体验过的伙伴分享工作与生活感受</text></view>
              <text v-else-if="!digest.count" class="sp-fbk__none">还没有做过这类岗位的伙伴写评价，你可以第一个来说说</text>
              <view v-if="reviewAppId" class="sp-fbk__write" hover-class="k-press-s" @click.stop="writeReview"><k-icon name="square-pen" :size="16" color="red" /><text>我在这家店做过，写评价</text></view>
              <view v-if="!isVolunteer && digest.count > digest.items.length" class="sp-fbk__all" hover-class="k-press" @click.stop="openStoreReviews"><text>查看全部 {{ digest.count }} 条</text><k-icon name="chevron-right" :size="14" color="red" /></view>
            </view>
            <!-- 整张卡进入当前门店的日常页，照片和视频在新页面打开。 -->
            <view v-if="isVolunteer || daily.length" class="sp-card sp-daily-card" role="button" aria-label="查看店里日常" hover-class="k-press-s" @click="openDaily">
              <view class="sp-section-link"><text class="sp-h k-display">店里日常</text><k-icon v-if="isVolunteer" name="chevron-right" :size="14" color="#A38A75" /></view>
              <view class="sp-daily" :class="[{ 'sp-daily--pair': isVolunteer || feedbackShown }, 'sp-daily--count-' + dailyShown.length]"><view v-for="(dailySrc, di) in dailyShown" :key="di" class="sp-daily__cell"><image v-if="dailySrc" class="sp-daily__img" :src="dailySrc" mode="aspectFill" /><view v-else class="sp-photo-empty"><k-icon name="image" :size="22" color="#A4917E" :stroke="1.3" /><text>待补充</text></view><view v-if="dailyMore && di === dailyShown.length - 1" class="sp-daily__more"><text>+{{ dailyMore }}</text></view></view></view>
            </view>
          </view>
          <!-- 13 换宿固定展示三行，保险和资质仍以真实资料为准；有执照才出现查看入口。 -->
          <view class="sp-card sp-card--warm sp-assure">
            <text class="sp-h k-display">袋鼠安心保障</text>
            <view class="sp-assure__panel">
              <view v-for="row in sections.assurance" :key="row.key" class="sp-bullet" :hover-class="row.link ? 'k-press' : 'none'" @click="tapAssurance(row)"><text class="sp-bullet__dot">·</text><text class="sp-bullet__text"><text class="sp-bullet__k">{{ row.k }}：</text><text :class="{ 'sp-assure__hl': row.key === 'insurance' && !row.pending }">{{ row.v }}</text></text><text v-if="row.link" class="sp-link" role="button" :aria-label="row.link" @click.stop="tapAssurance(row)">{{ row.link }}</text></view>
            </view>
          </view>
          <view v-if="trainingBanner" class="detail-training" hover-class="k-press-s" @click="openTraining">
            <image v-if="trainingBanner.img" class="detail-training__image" :src="absUrl(trainingBanner.img)" mode="aspectFill" />
            <view class="detail-training__body"><text class="detail-training__label">袋鼠成长课堂 · 培训活动</text><text class="detail-training__title">{{ trainingBanner.title }}</text><text class="detail-training__meta">{{ [trainingBanner.dateText, trainingBanner.city].filter(Boolean).join(' · ') }}</text><view class="detail-training__link"><text>了解课程与报名</text><k-icon name="arrow-right" :size="17" color="red" /></view></view>
          </view>
        </view>
      </view>
      <!-- 详情还没拿到：读取中写清楚，约 8 秒后提示网络慢；网络失败留在本页给重试；岗位没了提示后退回。之前这里什么都不显示，看着像坏了 -->
      <view v-else class="detail-state" role="status">
        <template v-if="loadState === 'error'">
          <k-icon name="info" :size="26" color="alert" />
          <text class="detail-state__title">岗位信息没有加载出来</text>
          <text class="detail-state__text">{{ loadError }}</text>
          <view class="detail-state__retry" role="button" hover-class="k-press-s" @click="retryLoad"><text>重新加载</text></view>
        </template>
        <text v-else-if="loadState === 'gone'" class="detail-state__title">{{ loadError }}</text>
        <template v-else>
          <text class="detail-state__title">正在加载岗位信息…</text>
          <text v-if="slowHint" class="detail-state__text">网络有点慢，还在加载，请再等一会儿</text>
        </template>
      </view>
      <city-coordinator v-if="detail && !isOnline" ref="coordinatorRef" :city="detail.city || storeInfo.city || ''" />
    </view>

    <k-bottom :pad="isVolunteer ? '9px 14px' : '12px 16px'"><!-- k-button 是虚拟节点组件：宽度放外层 view 上 --><view v-if="!isOnline && privateChatEnabled" class="team-button"><k-button block round type="outline" icon="user-round" :disabled="!detail" label="找人一起去" @click="openTeam" /></view><view class="apply-button"><k-button block round :disabled="!detail || (!myApplication && !!applyBlockedText)" :label="myApplication ? myApplication.label : applyBlockedText ? blockedShort : isOnline ? '报名申请' : '立即报名'" @click="openApply" /></view></k-bottom>
  </view>
  </k-feature-gate>
</template>

<script setup>
import { rememberDestination } from '@/common/camp-history.js'
import { privateChatEnabled } from '@/common/features.js'
import { publicShare, shareWithCover, timelineShare, showPublicShareMenu } from '@/common/public-share.js'
import { displayWording } from '@/common/display-wording.js'
import { ref, computed, onUnmounted } from 'vue'
import { onShow, onHide, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import { onJobFavoriteChange, publishJobFavoriteChange } from '@/common/job-favorite-events.js'
import { useScreen, go, back, toast } from '@/common/screen.js'
import { ensureSession, experience, getSessionRevision } from '@/common/experience.js'
import { noteShareVisit } from '@/common/share.js'
import { apiJobDetail, apiToggleFavorite, apiJobTrainingBanner } from '@/common/api.js'
import { get } from '@/common/request.js'
import { placeMapUrl, openNativePlace } from '@/common/place-navigation.js'
import { absUrl } from '@/common/upload.js'
import { modal } from '@/common/ui.js'
import R from '@/common/routes.js'
import { watch } from 'vue'
import { apiFollowStore } from '@/common/api.js'
import JobBadge from './components/job-badge.vue'
import JobVideoPlayer from './components/job-video-player.vue'
import ParttimeDetail from './components/parttime-detail.vue'
import JobMediaGrid from './components/job-media-grid.vue'
import CityCoordinator from './components/city-coordinator.vue'
import JobCitySubscribe from './components/job-city-subscribe.vue'
import { photoSlots, volunteerHero, volunteerSections } from './volunteer-presentation.js'
import { DETAIL_ART, EMPLOYMENT_FAC_ART } from './detail-art.js'
import {
  normalizeStorePage, interviewMode, heroVariant, interviewCard, heroLayout, tagLine, bullets, requirementCard, requirementLayout, workRow, statStrip, workTime, remainingHeadcount,
  volunteerWelfareColumns, lodgingCard, petCard,
  welfareCard, managerCard, facilityGrid, travelInfo, reviewDigest, dailyPhotos, assuranceRows, storeSubline, TRAVEL_NOTE, MODE_TEXT, scoreText, REVIEW_KIND
} from './store-page.js'

// ---------------------------------------------------------------------------
// 真实数据接入。
//
// 内测反馈 2.0（10-16）：之前是「职位概览 / 工作与权益 / 五维评分 / 评价摘要」四个步骤条样式的页签，看着不像能点，
// 前两页又把同一批信息各写一遍，改成两个普通页签（岗位信息 / 评价）。
// 2026-10-18 主人：顶上的两个页签也去掉，评价放进页面里「用户反馈」那一块（综合分、条数、前 3 条，点了看这家店全部评价），
// 首图右上角加收藏按钮（和标题旁的星标同一个状态），底部「找人一起去」改名「寻伴同行」。下面 s=1 / s=2 的说明是之前两页时的内容来源，留作对照：
//   s=1 岗位信息：顶部照片图集 → 标题 / 标签 / 收藏 → 关键信息（地点、薪资、日期、时长、排班、性别、食宿、住宿）→ 具体工作内容 → 我们希望你
//       → 奖金与结算 → 门店卡片。数据来自 /app/job/{jobId}，同一项只出现一次。（2026-10-18 起这一套只给线上任务用）
//       线下岗位 2026-10-18 改成「门店页」（主人效果图 41）：头图 + 采访方式角标 → 标题 / 收藏 → 标签行 → 位置与交通 → 采访视频 → 要求 → 招募三栏
//       → 工作内容 / 工作时间 → 福利 → 店长 → 该店亮点 → 用户反馈 / 店里日常 → 袋鼠安心保障 → 门店卡片（门店资料在详情接口的 storePage，见 ./store-page.js）。
//   s=2 评价：五维评分 + 评价概况 + 评价摘录（当时是 /app/stores/{storeId}/reviews?filter=application；现在「用户反馈」按同类岗位筛，见 loadReviews），
//       在这家店做过、还没评过的人顶上多一个「我在这家店做过，写评价」（详情接口给 myReviewableAppId）。
// 线上任务只有一页（任务信息），没有页签。旧链接带 s=2 / s=3 / s=4 的一律打开这一页（评价就在页面里）。
// ---------------------------------------------------------------------------

const jobId = ref('')
// jobId 由列表页跳转时带上（?jobId=），useScreen 的 onLoad 钩子里拿查询参数
const s = useScreen(4, {
  onLoad: async (q) => {
    // 只有一页了：旧链接带的 ?s=2/3/4（之前的「评价」页签）都打开这一页，评价在页面里「用户反馈」那一块
    s.value = 1
    jobId.value = (q && q.jobId) || ''
    // 员工分享的链接带 sc=分享码：记一次访问，报名成功后用于来源归因
    if (q && q.sc) noteShareVisit(jobId.value, q.sc)
    // 冷启动先恢复账号，再读取带收藏状态的详情；避免游客读取被随后恢复的账号作废。
    await ensureSession()
    return load()
  }
})

const detail = ref(null)
// 详情还没拿到时页面显示什么：loading 读取中 / error 读取失败，留在本页重试 / gone 岗位不存在或已下架
const loadState = ref('loading')
const loadError = ref('')
const slowHint = ref(false)
const SLOW_HINT_MS = 8000
let slowTimer = 0
let backTimer = 0
let latestRequest = 0
// 正在路上的读取；没有时是 0。详情还空着时 onShow 看它决定要不要重读
let readingRequest = 0
let firstShow = true
// 本页是否在最上层：盖上报名页、同行页或切到后台时 onHide，回来 onShow，关掉 onUnmounted
let pageOnTop = true
let pageClosed = false
const stopSlowHint = () => {
  if (slowTimer) clearTimeout(slowTimer)
  slowTimer = 0
  slowHint.value = false
}
const startSlowHint = () => {
  stopSlowHint()
  slowTimer = setTimeout(() => {
    slowTimer = 0
    if (!detail.value) slowHint.value = true
  }, SLOW_HINT_MS)
}
const cancelAutoBack = () => {
  if (backTimer) clearTimeout(backTimer)
  backTimer = 0
}
const coordinatorRef = ref(null)
const subscriptionRef = ref(null)
const travelExpanded = ref(false)
watch(() => detail.value?.jobId, () => { travelExpanded.value = false })
const isOnline = computed(() => detail.value?.jobType === 'online')
const trainingBanner = ref(null)
let trainingRequest = 0
watch(() => [detail.value?.jobId, detail.value?.jobType, detail.value?.city], async ([id, type, city]) => {
  const request = ++trainingRequest
  trainingBanner.value = null
  if (!id || type !== 'fulltime') return
  try {
    const response = await apiJobTrainingBanner(city || '')
    if (request === trainingRequest && response?.data?.activityId) trainingBanner.value = response.data
  } catch (_) { /* 未配置或暂时读取失败时，不影响岗位报名 */ }
})
function openTraining() {
  if (trainingBanner.value) go(R.activity + '?id=' + trainingBanner.value.activityId)
}
const favorite = ref(false)
const favoriteBusy = ref(false)
let favoriteRevision = 0
let detailRequest = 0
let favoriteOperation = 0
const captureFavoriteScope = () => ({ accountId: String(experience.account?.id || ''), session: getSessionRevision() })
const isFavoriteScopeCurrent = scope => scope.accountId === String(experience.account?.id || '') && scope.session === getSessionRevision()
let favoriteScope = captureFavoriteScope()
function syncFavoriteScope() {
  if (isFavoriteScopeCurrent(favoriteScope)) return
  favoriteScope = captureFavoriteScope()
  ++detailRequest
  ++favoriteOperation
  ++favoriteRevision
  favoriteBusy.value = false
  favorite.value = false
  if (detail.value) detail.value.favorite = false
}
// 退出登录或切换账号时立即清理上一会话的乐观值；旧请求不得阻塞或改写新账号。
watch(() => [experience.account?.id, getSessionRevision()], syncFavoriteScope, { flush: 'sync' })
const stopFavoriteSync = onJobFavoriteChange(change => {
  if (change.accountId !== String(experience.account?.id || '') || change.jobId !== String(jobId.value)) return
  ++favoriteRevision
  favorite.value = change.favorite
  if (detail.value) detail.value.favorite = change.favorite
})
onUnmounted(() => { pageClosed = true; pageOnTop = false; stopSlowHint(); cancelAutoBack(); ++detailRequest; ++favoriteOperation; stopFavoriteSync() })

/** boardText 为空时按 boardType 兜底，与岗位列表页用的是同一张表 */
const BOARD_FALLBACK = { all: '包吃包住', room: '包住宿', meal: '包三餐', part: '包部分', none: '不包食宿' }

const joinDot = (...parts) => parts.filter(Boolean).join(' · ')

/**
 * startDate 形如 2026-09-15T00:00:00.000-08:00，带时区偏移。
 * 直接按字符串取年月日，避免 new Date 在不同端（iOS 小程序解析更严格、
 * H5 会按本地时区换算）把日期整体偏移一天。
 */
const formatDate = (v) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || ''))
  return m ? Number(m[1]) + '年' + Number(m[2]) + '月' + Number(m[3]) + '日' : ''
}

// ---------------- 工作地点地图（V42） ----------------
// 门店发布线下岗位时在地图上选过点（或门店登记过坐标）才有 latitude / longitude（GCJ-02，和微信地图同一坐标）。
// 有坐标：概览里「工作地点」整行可点，打开微信地图看位置、导航；所有人都能点（地址本来就公开显示）。没有坐标照旧只显示文字。
// 线上任务是远程交付，没有工作地点
const mapPoint = computed(() => {
  const d = detail.value
  if (!d || d.jobType === 'online' || d.latitude == null || d.longitude == null || String(d.latitude).trim() === '' || String(d.longitude).trim() === '') return null
  const latitude = Number(d.latitude), longitude = Number(d.longitude)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || (latitude === 0 && longitude === 0)) return null
  return { latitude, longitude }
})
// 网页使用地图官方链接；小程序仅用门店坐标打开目的地，缺失时提示补充定位。
const mapTag = '地图'
const openMap = () => {
  const d = detail.value || {}
  if (d.jobType === 'online') return
  // #ifdef H5
  const url = placeMapUrl(d)
  if (!url) return toast('门店位置待补充')
  window.location.assign(url)
  // #endif
  // #ifndef H5
  openNativePlace(d, uni, toast)
  // #endif
}
const tapRow = (item) => { if (item && item.tap) openMap() }

// 性别偏好（V48，只有换宿旅行有）：F 女生 / M 男生，空 = 男女不限（门店没填就是不限）
const GENDER_TEXT = { F: '女生', M: '男生' }
const genderText = (d) => d.jobType !== 'volunteer' ? '' : d.genderMaleCount != null && d.genderFemaleCount != null
  ? `男生 ${d.genderMaleCount} 人 · 女生 ${d.genderFemaleCount} 人` : (GENDER_TEXT[d.genderPref] || '男女不限')

/** settleDesc 形如「月结 · 次月5日前发放」，薪资待遇行只要前半截的结算周期 */
const settleCycle = (v) => String(v || '').split('·')[0].trim()

const title = computed(() => (detail.value && detail.value.title) || '')
// 详情没返回封面时退回设计稿原来的那张图，避免 hero 区出现空白块。
// 之前直接用接口里的 cover：门店上传的封面是 /profile/upload/… 相对路径，小程序里按本地路径去找，头图一片空白（列表页同一张图是好的）
const cover = computed(() => absUrl(detail.value && detail.value.cover) || '/static/media/cover-empty.png')
// 岗位照片（V49）：门店传的最多 9 张，顶部可以左右滑；没传照片时只有封面一张（服务端的 cover 已按 第一张照片 → 岗位封面 → 门店封面 取好）
const gallery = computed(() => {
  const environment=detail.value?.storePage?.environmentImages||[]
  const list = (environment.length?environment:((detail.value && detail.value.images) || [])).map(x => absUrl(x)).filter(Boolean)
  return list.length ? list : [cover.value]
})
// 「共 N 张」只数真实照片，占位封面不算（规则和下面 parttimeModel 的 gallery 一样）。10.28.4 起模板用了这个名字却没定义，换宿岗位在小程序里一直空白
const images = computed(() => gallery.value.filter(src => !src.endsWith('/static/media/cover-empty.png')))
const heroIndex = ref(0)
const onHeroChange = (e) => { heroIndex.value = Number(e && e.detail && e.detail.current) || 0 }
// 点照片看大图（能左右翻）；只有占位图时不打开
function previewHero(i) {
  const urls = gallery.value.filter(u => u && !u.startsWith('/static/'))
  if (!urls.length || typeof uni === 'undefined') return
  uni.previewImage({ urls, current: urls[Math.min(i, urls.length - 1)] || urls[0] })
}

// 设计稿这里是"96%匹配"。匹配算法属于未确认的业务规则，不能编一个百分比，
// 改为展示同一位置上真实且有意义的信息：剩余招聘名额。取不到就整个隐藏胶囊。
const headcountText = computed(() => {
  const d = detail.value
  const left = remainingHeadcount(d)
  if (left == null) return ''
  return left > 0 ? ('还招 ' + left + ' 人') : '名额已满'
})

// 字典 safe_cert「0已认证 1未认证」、insurance_flag「0含 1不含」，取值与直觉相反，
// 之前 s=1 与 s=2 各判一次极性，s=2 判反了。这里收敛成两个 computed 作为唯一真值源，
// 两屏都只读它们，避免再次漂移。
// safeCert 详情里有两处出口（岗位关联字段 d.safeCert 与 d.store.safeCert），
// 后端同源于 kg_store.safe_cert，以 store 子对象为准，缺失时退回关联字段。
const safeCertified = computed(() => {
  const d = detail.value
  if (!d) return false
  const v = d.store && d.store.safeCert != null ? d.store.safeCert : d.safeCert
  return String(v) === '0'
})
const insured = computed(() => String(detail.value && detail.value.insuranceFlag) === '0')

// 两样都有：头图挂「经袋鼠实地拍摄并含保险」角标，下面不再重复写「安心商家 · 含保险」；线上任务永远不挂
const assured = computed(() => !isOnline.value && safeCertified.value && insured.value)
// "安心商家 · 含保险"按门店认证与岗位保险标记真实拼接，两个都不满足时整行隐藏。
const safeText = computed(() => {
  if (!detail.value) return ''
  const parts = []
  if (safeCertified.value) parts.push('安心商家')
  if (insured.value) parts.push('含保险')
  return parts.join(' · ')
})
// 不能报名时底部按钮置灰（写「暂不可报名」），概览和权益两屏顶部写明原因：之前按钮照样能点，线上任务过了截止时间、名额满了，
// 要把表填完、提交时才被拒。原因以详情接口为准（acceptsApplication=false 时服务端给的 applyClosedReason，如线上任务已过截止时间、名额已满），
// 没给原因的老接口按暂停 / 名额已满兜底
const myApplication=computed(()=>isOnline.value ? detail.value?.myApplication : null)
const applyBlockedText = computed(() => {
  const d = detail.value
  if (!d) return ''
  if (d.acceptsApplication === false) return d.applyClosedReason || (d.status === 'paused' ? '该岗位暂停招聘中，暂不接受报名' : '该岗位当前不接受报名')
  if (d.status === 'paused') return '该岗位暂停招聘中，暂不接受报名'
  if (d.status === 'closed') return '该岗位已结束招聘，暂不接受报名'
  if (remainingHeadcount(d) === 0) return '该岗位名额已满，暂不接受报名'
  return ''
})
// 不能报名时标题旁的胶囊、底部按钮用的短说法：之前已暂停的岗位标题旁仍是绿色「还招 N 人」，和列表卡片「已暂停招聘」对不上。
// 现在改成灰色胶囊，和列表卡片同一套说法（已暂停招聘 / 名额已满）；完整原因在概览、权益两屏顶部的红色提示条里。线上任务、线下岗位一样
const blockedShort = computed(() => {
  const d = detail.value
  if (!d || !applyBlockedText.value) return ''
  // 先看原因：线上任务过了截止时间又恰好暂停或满员时，服务端给的原因是「已过截止时间」，胶囊要和红色提示条说同一件事
  // ended：岗位已关（或门店已停），报过名 / 收藏过的人只读打开
  if (d.ended === true || d.status === 'closed') return '已结束招聘'
  if (/截止/.test(applyBlockedText.value)) return '已过截止时间'
  if (d.status === 'paused') return '已暂停招聘'
  if (/名额/.test(applyBlockedText.value) || remainingHeadcount(d) === 0) return '名额已满'
  return '暂不可报名'
})

const overviewInfo = computed(() => {
  const d = detail.value || {}
  if (isOnline.value) return [
    { icon: 'globe', label: '参与方式', value: '全国远程 · 无需到店' },
    { icon: 'badge-dollar-sign', label: '任务报酬', value: d.compensationText || d.salaryText || '以任务约定为准' },
    ...(d.bonusDesc ? [{ icon: 'badge-dollar-sign', label: '奖金规则', value: d.bonusDesc }] : []),
    ...(d.commissionDesc ? [{ icon: 'badge-dollar-sign', label: '提成规则', value: d.commissionDesc }] : []),
    { icon: 'calendar-days', label: '交付时间', value: d.deliverDesc || '以任务说明为准' },
    ...(d.estHours ? [{ icon: 'clock-3', label: '预计耗时', value: d.estHours }] : []),
    { icon: 'wallet-cards', label: '任务结算', value: '成果验收通过后，发布方按约定方式付款，无需到店' }
  ]
  // 关键信息：每项只出现一次。奖金、提成、结算方式放到下面「奖金与结算」；食宿先用门店写的说明（boardDesc），没写再用食宿类型
  return [
    { icon: 'map-pin', label: '工作地点', value: joinDot(d.address, d.city), tap: !!mapPoint.value || !!String(d.address || '').trim() },
    { icon: 'briefcase-business', label: '工作类型', value: (d.tags || []).join(' / ') },
    { icon: 'badge-dollar-sign', label: '薪资待遇', value: joinDot(d.compensationText || d.salaryText, settleCycle(d.settleDesc)) },
    { icon: 'calendar-days', label: '开始日期', value: formatDate(d.startDate) ? formatDate(d.startDate) + ' 可入职' : '' },
    { icon: 'clock-3', label: '最短时长', value: d.minDays ? d.minDays + '天起' : (d.minDaysText || '') },
    { icon: 'clock-3', label: '工作时长', value: d.dailyHours || '' },
    // 休息排班（V48：做五休二这类）写在门店的排班说明前面
    { icon: 'calendar-clock', label: '排班方式', value: joinDot(d.restModeLabel, d.shiftDesc, d.shiftTime) },
    { icon: 'users-round', label: '性别偏好', value: genderText(d) },
    { icon: 'house', label: '食宿安排', value: d.boardDesc || d.boardText || BOARD_FALLBACK[d.boardType] || '' },
    { icon: 'bed-double', label: '住宿条件', value: d.roomTypeLabel || '' }
  ]
})

// 奖金与结算（线下岗位）：门店写了才显示；线上任务的报酬、奖金都在上面的关键信息里
const payRows = computed(() => {
  const d = detail.value || {}
  if (isOnline.value) return []
  return [
    { icon: 'badge-dollar-sign', label: '奖金规则', value: d.bonusDesc || '' },
    { icon: 'badge-dollar-sign', label: '提成规则', value: d.commissionDesc || '' },
    { icon: 'wallet-cards', label: '结算方式', value: d.settleDesc || '' }
  ].filter(item => item.value)
})

// 门店没填的项不显示空白行（之前「生活用品」等行永远是空的，只有标签没有内容）
const overviewRows = computed(() => overviewInfo.value.filter(item => item.value))

/**
 * content / requirement 后端存的是整段文本。按换行拆成条目后统一补「· 」前缀，
 * 与设计稿里的列表观感一致（.plain-card__list 是 white-space: pre-line，换行会生效）。
 * 原文若已经带了项目符号则先去掉，避免出现两个点。
 */
const bulletize = (text) => String(text || '')
  .split(/\r?\n/)
  .map((line) => line.trim().replace(/^[·•\-*]\s*/, ''))
  .filter(Boolean)
  .map((line) => '· ' + line)
  .join('\n')

const contentText = computed(() => bulletize(detail.value && detail.value.content))
const requirementText = computed(() => bulletize(detail.value && detail.value.requirement))

/**
 * 岗位确实没了：提示后退回上一页；延时是为了让 toast 来得及显示。
 * 退回前看本页还在不在最上层：之前不看，等待期间进了报名页、同行页，会把那一页弹掉，回到空白的详情页。
 * 不在最上层时不提示也不退回，用户回到本页时 onShow 会再读一次。
 */
const failAndBack = (msg) => {
  stopSlowHint()
  cancelAutoBack()
  loadState.value = 'gone'
  loadError.value = msg
  if (!pageOnTop) return
  toast(msg)
  backTimer = setTimeout(() => {
    backTimer = 0
    if (pageOnTop) back()
  }, 900)
}

// 只有服务端明确说岗位没了才退回（库里没有、已下架、门店停用，都是业务拒绝的这几句话），岗位编号不合法是 400。
// 断网和超时（code -1）、网关错误页（「服务返回异常」）、服务端故障（「系统繁忙」）都不算，留在本页让用户重试
const isJobGone = (e) => e?.code === 400 || e?.code === 404 || /不存在|已下架|已删除/.test(String(e?.message || ''))

// 详情还空着时重读一次。先等账号恢复（见上面 onLoad 的注释）；等的期间详情到了、页面关了或者已经有新的读取，就不再发
async function reloadEmpty() {
  const started = latestRequest
  await ensureSession()
  if (pageClosed || detail.value || started !== latestRequest) return
  return load()
}
// 响应作废（账号恢复或切换、令牌失效）：有更新的读取在路上就交给它；没有的话，详情还空着就按当前账号重读，不能一直空白
const recoverDropped = (request) => {
  if (pageClosed || detail.value || request !== latestRequest) return
  return reloadEmpty()
}
const retryLoad = () => {
  if (loadState.value === 'loading') return
  loadState.value = 'loading'
  startSlowHint()
  return reloadEmpty()
}

const load = async ({ background = false } = {}) => {
  if (pageClosed) return
  syncFavoriteScope()
  if (!jobId.value) {
    failAndBack('岗位不存在或已下架')
    return
  }
  if (!detail.value) {
    loadState.value = 'loading'
    loadError.value = ''
  }
  const request = ++detailRequest
  latestRequest = request
  readingRequest = request
  const scope = captureFavoriteScope()
  const favoriteAtRequest = favoriteRevision
  const wasFavoritePending = favoriteBusy.value
  try {
    const res = await apiJobDetail(jobId.value)
    if (request !== detailRequest || !isFavoriteScopeCurrent(scope)) return recoverDropped(request)
    detail.value = res.data || null
    rememberDestination(experience.account?.id, detail.value?.city || detail.value?.store?.city)
    if (!detail.value) {
      failAndBack('岗位不存在或已下架')
      return
    }
    stopSlowHint()
    // 收藏写入期间或写入前发出的详情请求，不能用旧状态覆盖刚确认的星标。
    if (!wasFavoritePending && !favoriteBusy.value && favoriteAtRequest === favoriteRevision) {
      favorite.value = !!detail.value.favorite
    } else {
      detail.value.favorite = favorite.value
    }
    guestLoaded = !experience.account
    if (heroIndex.value >= gallery.value.length) heroIndex.value = 0
    if (!isOnline.value) loadReviews()
  } catch (e) {
    if (request !== detailRequest || !isFavoriteScopeCurrent(scope)) return recoverDropped(request)
    if (background) toast((e && e.message) || '岗位信息更新失败，请重试')
    else if (isJobGone(e)) failAndBack('岗位不存在或已下架')
    else {
      stopSlowHint()
      loadState.value = 'error'
      loadError.value = (e && e.message) || '网络连接失败，请检查网络后重试'
    }
  } finally {
    if (readingRequest === request) readingRequest = 0
  }
}

/** 保持即时点亮，保存成功后使用服务端结果；失败恢复，连续点击只提交一次。 */
const toggleFavorite = async () => {
  syncFavoriteScope()
  if (!detail.value || favoriteBusy.value) return
  const operation = ++favoriteOperation
  const scope = captureFavoriteScope()
  const current = () => operation === favoriteOperation && isFavoriteScopeCurrent(scope)
  favoriteBusy.value = true
  let previous = null
  try {
    if (await needLogin('收藏')) return
    if (!current()) return
    const accountId = experience.account?.id
    previous = favorite.value
    const next = !previous
    favoriteRevision++
    favorite.value = next
    const res = await apiToggleFavorite(jobId.value, next)
    if (!current()) return
    favorite.value = typeof res?.data?.favorite === 'boolean' ? res.data.favorite : next
    detail.value.favorite = favorite.value
    publishJobFavoriteChange(accountId, jobId.value, favorite.value)
    toast(favorite.value ? '已收藏，可在「我的」→「收藏与关注」中查看' : '已取消收藏')
  } catch (e) {
    if (!current()) return
    if (previous !== null) {
      favorite.value = previous
      if (detail.value) detail.value.favorite = previous
    }
    toast((e && e.message) || '收藏保存失败，请重试')
  } finally {
    if (current()) {
      favoriteRevision++
      favoriteBusy.value = false
    }
  }
}

const openApply = async () => {
  if(myApplication.value)return go(myApplication.value.path)
  // 之前只说"当前不接受报名"，看不出原因；名额已满时还能把三步表单填完，提交才被拒。原因在详情数据里都有，直接说清楚
  if (applyBlockedText.value) return toast(applyBlockedText.value)
  if (await needLogin('报名')) return
  go(R.jobApply + '?jobId=' + jobId.value + '&title=' + encodeURIComponent(title.value))
}

// 游客点报名 / 收藏 / 关注：之前游客能把整张报名表填完，提交时才被拒，只弹「未登录或登录已失效」，没有登录入口；
// 收藏、关注也只弹一句提示。现在先问一句再带去登录，登录页压在本页上面，登录完自动退回本页接着操作（见 login.vue completeEntry）
let guestLoaded = false
async function needLogin(what) {
  await ensureSession()
  if (experience.account) return false
  const r = await modal('请先登录', what + '需要先登录，登录后会回到这个' + (isOnline.value ? '任务' : '岗位') + '。', { confirmText: '去登录', cancelText: '再看看' })
  if (r.confirm) go(R.login)
  return true
}
// 从报名 / 进度页返回后重读剩余名额（也覆盖撤回后的释放）；登录和评价返回同样刷新。
let reviewOpened = false
onShow(() => {
  pageOnTop = true
  const entering = firstShow
  firstShow = false
  coordinatorRef.value?.refresh()
  subscriptionRef.value?.refresh()
  if (detail.value || (guestLoaded && experience.account) || reviewOpened) {
    guestLoaded = false; reviewOpened = false; load({ background: !!detail.value })
  } else if (entering) {
    // 第一次 onShow 紧跟 onLoad，读取已由 onLoad 发起（它先等账号恢复），这里不再发一次，只开始计时
    startSlowHint()
  } else if (!readingRequest) {
    // 详情还空着就回到了本页（之前读取失败、响应作废、切后台回来）：重读一次，不能一直空白。
    // 还有读取在路上就等它：再发一次会把马上要到的结果判作废，反而多等一轮；它失败或作废时 load 自己会处理，慢网提示也接着算
    loadState.value = 'loading'
    startSlowHint()
    reloadEmpty()
  }
})
onHide(() => {
  pageOnTop = false
  cancelAutoBack()
})

// ---------------- 写评价（内测反馈 2.0） ----------------
// 在这家店做过（门店标记过入职）、还没评过的报名：详情接口给 myReviewableAppId（游客、没做过、都评过时为空），「用户反馈」里出「我在这家店做过，写评价」
const reviewAppId = computed(() => (!isOnline.value && detail.value && detail.value.myReviewableAppId) || '')
function writeReview() {
  if (!reviewAppId.value) return
  reviewOpened = true
  go(R.review + '?bizType=application&bizId=' + reviewAppId.value)
}

const openTeam = () => go(R.jobTeam + '?jobId=' + jobId.value)

// ---------------- 门店卡片与关注（V37） ----------------
// 之前详情页既看不出是哪家店发的，也关注不了（只有房源 Vlog 里能关注主理人）。
// 现在概览页底部有门店卡片：关注后这家店发布新岗位会在消息中心通知你；点门店名进「我的关注」看这家店在招的其他岗位
const storeInfo = computed(() => (detail.value && detail.value.store) || {})
const storeCover = computed(() => absUrl(storeInfo.value.cover))
const following = ref(false)
const followBusy = ref(false)
// 是否已关注由详情接口给（store.following，游客为 false）；每次重新拉详情都以服务端为准
watch(detail, (d) => { following.value = !!(d && d.store && d.store.following) })
// 门店卡片上的分：拉到这家店的评价后用「用户反馈」那个综合分（同一个数、同一个写法），没拉到（线上任务、老服务端）再用门店资料里的评分
const storeScore = computed(() => digest.value.avgText || scoreText(storeInfo.value.rating))
const storeMeta = computed(() => joinDot(
  storeInfo.value.city,
  storeScore.value ? storeScore.value + ' 分' : '',
  following.value ? '已关注，上新会通知你' : '关注后上新会通知你'
))
const openStoreJobs = () => { if (storeInfo.value.storeId) go(R.myFollows + '?storeId=' + storeInfo.value.storeId) }
async function toggleFollow() {
  const sid = storeInfo.value.storeId
  if (!sid || followBusy.value) return
  if (await needLogin('关注门店')) return
  const next = !following.value
  followBusy.value = true
  try {
    const res = await apiFollowStore(sid, next)
    following.value = res && res.data ? !!res.data.following : next
    toast((res && res.data && res.data.message) || (next ? '已关注这家店' : '已取消关注'))
  } catch (e) {
    toast(e && e.code === 401 ? '登录后才能关注门店' : ((e && e.message) || '操作失败，请重试'))
  } finally {
    followBusy.value = false
  }
}
// 换工类型的名字（后台字典 kg_volunteer_kind）；老岗位、非换工岗位没有就不显示
const kindLabel = computed(() => (!isOnline.value && detail.value && detail.value.workKindLabel) || '')
// 做满一个月有红包（V44，后端给布尔；老服务端没有这个字段时不显示）
const redpacket = computed(() => !isOnline.value && !!detail.value && detail.value.monthRedpacket === true)
const openOnlineGuide = () => go(R.notice + '?key=online-guide')

// ---------------- 线下岗位「门店页」（2026-10-18 改版，主人效果图 41） ----------------
// 门店资料在详情接口的 storePage 里（线上任务为 null）；老服务端没有这个字段时按 null 处理，各块自己判断有没有数据。
// 拼装逻辑都在 ./store-page.js（纯函数，node 测试直接测），这里只把岗位数据接上去
const storePage = computed(() => (!isOnline.value && detail.value && detail.value.storePage) || null)
// 采访方式 onsite / online / ''：以 storePage 为准，没有 storePage 时按安心商家认证推（认证 == 去现场拍过）
const mode = computed(() => interviewMode({ isOnline: isOnline.value, storePage: storePage.value, safeCertified: safeCertified.value }))
// 头图左上角角标：实地探访 + 含保险「经袋鼠实地拍摄并含保险」，只有实地探访「经袋鼠实地探访」，线上采访「经袋鼠线上采访」，都没有不挂
const badgeVariant = computed(() => heroVariant({ isOnline: isOnline.value, mode: mode.value, insured: insured.value }))
const heroGrid = computed(() => isVolunteer.value ? volunteerHero(gallery.value) : heroLayout(gallery.value))
// 食宿短说法（标签行用）：门店写的食宿类型文字，没有按类型兜底
const boardShort = computed(() => { const d = detail.value || {}; return d.boardText || BOARD_FALLBACK[d.boardType] || '' })
const tagParts = computed(() => tagLine(detail.value, {
  kindLabel: kindLabel.value, board: boardShort.value,
  bonus: redpacket.value || !!(detail.value && detail.value.bonusDesc),
  status: blockedShort.value || headcountText.value
}))
const displayTags = computed(() => isVolunteer.value ? tagLine(detail.value, {
  kindLabel: kindLabel.value || '换宿换工', board: boardShort.value || '食宿待补充',
  bonus: redpacket.value || !!detail.value?.bonusDesc, status: blockedShort.value || headcountText.value || '名额待确认'
}) : tagParts.value)
const placeText = computed(() => { const d = detail.value || {}; return joinDot(d.address, d.city) })
const travel = computed(() => travelInfo(storePage.value))
// 正常长度完整展开，与原稿一致；长地址或长交通说明仍可展开阅读全文。
const travelCanExpand = computed(() => placeText.value.length > 52 || travel.value.rows.some(row => row.v.length > 100))
const interview = computed(() => interviewCard(storePage.value, mode.value))
const pendingInterview = computed(() => mode.value === 'online'
  ? { title: '线上采访视频待上传', caption: '视频连线店长 · 工作、食宿与门店情况', chip: '线上采访影像待补充' }
  : mode.value === 'onsite'
    ? { title: '实地探访视频待上传', caption: '线下实地探访 · 工作、食宿与门店实景', chip: '实地探访影像待补充' }
    : { title: '门店采访待补充', caption: '采访资料待补充 · 工作、食宿与门店情况', chip: '暂无采访资料' })
const interviewCover = computed(() => absUrl(interview.value && interview.value.cover))
const reqCard = computed(() => (detail.value ? requirementCard(detail.value, genderText(detail.value)) : null))
const stats = computed(() => statStrip(detail.value))
const contentLines = computed(() => bullets(detail.value && detail.value.content))
const work = computed(() => workTime(detail.value))
const welfare = computed(() => welfareCard(detail.value, {
  board: (detail.value && detail.value.boardDesc) || boardShort.value, redpacket: redpacket.value, insured: insured.value
}))
const volunteerBenefits = computed(() => volunteerWelfareColumns(welfare.value, detail.value?.boardType))
// 住宿展示（V66）：提供住宿的岗位保留展示区；宠物仍只展示门店填写的资料。
const lodgingInfo = computed(() => (isOnline.value ? null : lodgingCard(detail.value)))
const petInfo = computed(() => (isVolunteer.value ? petCard(detail.value) : null))
const manager = computed(() => managerCard(storePage.value))
const managerAvatar = computed(() => absUrl(manager.value && manager.value.avatar) || (isVolunteer.value ? '' : '/static/media/profile-avatar.jpg'))
const facilities = computed(() => facilityGrid(storePage.value))
// 用户反馈：这家店真实岗位评价的综合分、条数、好评率 + 前 3 条（见 ./store-page.js reviewDigest）；头像换成完整地址
const digest = computed(() => {
  const x = reviewDigest(rv.value)
  return { ...x, items: x.items.map(it => ({ ...it, avatar: it.avatar ? absUrl(it.avatar) : '' })) }
})
// 店里日常：门店资料里的照片（服务端已用小院生活碎片兜底），没有再用岗位照片；格子里放 4 张，多的写 +N，点开能翻全部
const DAILY_SHOWN = 4
const daily = computed(() => dailyPhotos(storePage.value, (detail.value && detail.value.images) || []).map(x => absUrl(x)).filter(Boolean))
const dailyShown = computed(() => isVolunteer.value ? photoSlots(daily.value, Math.max(1, Math.min(2, daily.value.length))).map(cell => cell.src) : daily.value.slice(0, DAILY_SHOWN))
const dailyMore = computed(() => Math.max(0, daily.value.length - dailyShown.value.length))
function openDaily() {
  if (!jobId.value) return
  go('/pages/stays/diary?jobId=' + encodeURIComponent(jobId.value))
}
function previewDaily(i) {
  const urls = daily.value
  if (!urls.length || typeof uni === 'undefined') return
  uni.previewImage({ urls, current: urls[Math.min(i, urls.length - 1)] || urls[0] })
}
const licenseUrl = computed(() => absUrl(normalizeStorePage(storePage.value).licenseImage))
const assurance = computed(() => assuranceRows({ insured: insured.value, licenseImage: licenseUrl.value }))
// 「门店资质」那一行点了看营业执照；其他行不响应
function tapAssurance(row) {
  if (!row || row.key !== 'license') return
  if (!licenseUrl.value) return toast('门店暂未上传营业执照')
  if (typeof uni === 'undefined') return
  uni.previewImage({
    urls: [licenseUrl.value], current: licenseUrl.value,
    fail: () => toast('营业执照暂时无法打开，请稍后重试')
  })
}
const storeSub = computed(() => storeSubline(mode.value))
// 展示层补齐原稿卡片。原始资料保持不变，播放/预览/报名依然读取真实数据。
const sections = computed(() => {
  const data = {
    travel: travel.value, requirements: reqCard.value, stats: stats.value, content: contentLines.value,
    work: work.value, welfare: welfare.value, benefits: volunteerBenefits.value, manager: manager.value,
    facilities: facilities.value, assurance: assurance.value, insuranceFlag: detail.value?.insuranceFlag
  }
  return isVolunteer.value ? volunteerSections(data) : data
})

// ---------------- 岗位参考版式：换宿、兼职与全职 ----------------
// 兼职 / 全职用版式 1b（头图三张并排、招募信息表、岗位招募要求两卡并排、深棕标题头的工作待遇），换宿旅行用版式 1；数据和交互两种版式完全一样
const pt = computed(() => { const t = detail.value && detail.value.jobType; return t === 'parttime' || t === 'fulltime' })
const isParttime = computed(() => detail.value?.jobType === 'parttime')
const isVolunteer = computed(() => detail.value?.jobType === 'volunteer')
// 两种采访方式共用同一版式，保险字样只跟随岗位真实保险字段。
const volunteerVisitLabel = computed(() => mode.value === 'onsite'
  ? '袋鼠实地探访'
  : mode.value === 'online' ? '袋鼠线上采访' : '')
// 「兼职岗位｜平潭」：岗位类型 + 城市（城市取「·」前那段）
const ptSubline = computed(() => {
  const d = detail.value || {}
  const city = String(d.city || '').split('·')[0].trim()
  return [d.jobType === 'fulltime' ? '全职岗位' : '兼职岗位', city].filter(Boolean).join('｜')
})
// 版式 1b 头图底部那条白字：「袋鼠线下实地探访｜含意外险」/「袋鼠线上采访」；没采访不出（和角标同一个口径：含保险只在岗位真的含保险时写）
const heroCaption = computed(() => {
  if (mode.value === 'onsite') return '袋鼠线下实地探访' + (insured.value ? '｜含意外险' : '')
  if (mode.value === 'online') return MODE_TEXT.online
  return ''
})
// 视频卡左上角的标题：版式 1 写「5分钟实地采访」；版式 1b 写「袋鼠实地探访 · 5分钟线下采访」
const videoTitle = computed(() => {
  const v = interview.value
  if (!v) return ''
  return pt.value && MODE_TEXT[mode.value] ? MODE_TEXT[mode.value] + ' · ' + v.title.replace('实地采访', '线下采访') : v.title
})
// 版式 1b 的招募信息表：招募人数 | 最短服务期；预计到岗。没填的格子不出
const ptStats = computed(() => {
  const m = {}
  for (const st of stats.value) m[st.k] = st.v
  return [
    { k: '招募人数', v: m['招募信息'] || '' },
    { k: '最短服务期', v: m['最短期限'] || '' },
    { k: '预计到岗', v: m['到岗时间'] || '' }
  ].filter(x => x.v)
})
// 招募信息表几列：一两格按格数均分，四格排成 2×2，其余三列（不留一整行空格子）
const ptCols = computed(() => { const n = ptStats.value.length; return n === 4 ? 2 : Math.min(n, 3) })
// 要求区统一两列横排；识别标签用于加粗换色，原始岗位内容保持不变。
const reqLayout = computed(() => requirementLayout(sections.value.requirements?.rows))
// 工作内容一行行同样拆掉冒号（「前台：接待客人」→ 加粗的「前台」+ 接待客人），模板写的「1. 」序号去掉（前面已经有圆点）
const workRows = computed(() => (sections.value.content || []).map(workRow))
// 该店亮点：参考图里那六个彩色立体小图标（从参考图裁下来，放在 jobs 分包的 static 里，不进主包）；其余设施照旧用线条图标
const FAC_IMG = {
  gym: '/pages/jobs/static/fac-gym.png', pool: '/pages/jobs/static/fac-pool.png', ebike: '/pages/jobs/static/fac-ebike.png',
  parking: '/pages/jobs/static/fac-parking.png', cook: '/pages/jobs/static/fac-cook.png', lounge: '/pages/jobs/static/fac-lounge.png'
}
// 兼职与全职共用参考版式，收藏、报名、地图、媒体与评价仍由本页原有逻辑处理。
const parttimeModel = computed(() => ({
  title: displayWording(title.value, [storeInfo.value.storeName]) || storeInfo.value.storeName,
  recruitmentTitle: detail.value?.jobType === 'fulltime' ? '全职招募要求' : '兼职招募要求',
  gallery: gallery.value.filter(src => !src.endsWith('/static/media/cover-empty.png')), heroCaption: heroCaption.value,
  subline: ptSubline.value, status: blockedShort.value || headcountText.value,
  blocked: applyBlockedText.value, safe: safeCertified.value, favorite: favorite.value, favoriteBusy: favoriteBusy.value,
  headcount: stats.value.find(x => x.k === '招募信息')?.v || '',
  arrival: formatDate(detail.value?.startDate), minDays: stats.value.find(x => x.k === '最短期限')?.v || '',
  travel: travel.value, travelNote: TRAVEL_NOTE, place: placeText.value, map: !!mapPoint.value, mapTag,
  interview: interview.value ? { ...interview.value, cover: interviewCover.value, mode: MODE_TEXT[mode.value] } : null,
  playing: playing.value,
  content: contentLines.value, work: work.value, requirements: reqLayout.value,
  recruitmentFee: detail.value?.jobType === 'fulltime' ? '平台从第一个月的底薪中扣取10%服务费，只收一次。' : '平台按实际工作日期，从每天工资中扣取10%服务费。',
  welfare: welfare.value, board: detail.value?.boardDesc || boardShort.value, lodging: lodgingInfo.value,
  pendingInterview: pendingInterview.value, insuranceFlag: detail.value?.insuranceFlag,
  manager: manager.value ? { ...manager.value, avatar: absUrl(manager.value.avatar) } : null,
  facilities: facilities.value.map(x => ({ ...x, image: EMPLOYMENT_FAC_ART[x.code] || '' })),
  digest: digest.value, reviewAppId: reviewAppId.value, daily: daily.value, assurance: assurance.value,
  store: storeInfo.value, following: following.value, followBusy: followBusy.value,
  training: trainingBanner.value ? { ...trainingBanner.value, img: absUrl(trainingBanner.value.img) } : null
}))
// 「用户反馈」那一块出不出：有评价，或者自己做过可以写评价
const feedbackShown = computed(() => !!(digest.value.count || reviewAppId.value))
// 正在播的采访视频 {url, cover, title}；空对象 = 没在播（播放层不出现）。和小院详情的 playVideo 同一套
const playing = ref({})
function playInterview() {
  const v = interview.value
  if (!v || !v.url) return toast('视频暂时看不了')
  playing.value = { url: v.url, cover: v.cover || '', title: v.title || '' }
}
const closeVideo = () => { playing.value = {} }

// ---------------- 用户反馈（这家店同类岗位的评价） ----------------
const rv = ref(null)
// 换宿岗位看「换工」评价、兼职看「兼职」、全职看「全职」（store-page.js REVIEW_KIND）：住宿客人的评价不放在招人的岗位页上
const reviewKind = computed(() => REVIEW_KIND[detail.value && detail.value.jobType] || '')
let reviewLoadVersion = 0
async function loadReviews() {
  const version = ++reviewLoadVersion
  rv.value = null
  if (isOnline.value) return
  const sid = detail.value && detail.value.store && detail.value.store.storeId
  if (!sid) return
  const filter = reviewKind.value
  try {
    // 摘要与二级评价页使用同一套招聘门店接口，代招时不再按发布门店统计。
    const endpoint = '/app/stores/' + sid + '/job-reviews'
    const [summary, list] = await Promise.all([
      get(endpoint + '/summary', { filter }),
      get(endpoint, { filter, tab: 'all', sort: 'latest', pageNum: 1 })
    ])
    if (version !== reviewLoadVersion || detail.value?.store?.storeId !== sid || reviewKind.value !== filter) return
    const data = summary.data || {}
    rv.value = { ...data, list: list.data?.rows || [], jobGoodRate: data.recommendRate == null ? '' : data.recommendRate + '%' }
  } catch (e) {
    if (version === reviewLoadVersion) rv.value = null
  }
}
// 用户反馈进入独立评价页，沿用当前门店与岗位类型。
const openStoreReviews = () => {
  const sid = detail.value && detail.value.store && detail.value.store.storeId
  if (sid) go(R.jobReviews + '?storeId=' + sid + (reviewKind.value ? '&filter=' + encodeURIComponent(reviewKind.value) : '') + (reviewAppId.value ? '&appId=' + reviewAppId.value : ''))
}

const pageShareMessage = () => publicShare('/pages/jobs/detail', {jobId:jobId.value}, detail.value?.title || '袋鼠全球青年 · 旅行岗位')

onShareAppMessage((event) => shareWithCover(pageShareMessage(event)))
onShareTimeline(() => timelineShare(pageShareMessage()))
onShow(showPublicShareMenu)
</script>

<style scoped lang="scss">
/* 10-19 参考图：页面是极浅暖米渐变底（顶部 #F7EFE6 → #FBF7F1），不是纯白；顶栏跟着页面底色（--k-bg） */
.detail-page { font-family: var(--k-sans); --k-bg: #F7EFE6; background: linear-gradient(180deg, #F7EFE6 0%, #FBF7F1 360px, #FBF7F1 100%); }
/* 底部操作栏：白底 + 上方一道柔和阴影；左「寻伴同行」深色描边大胶囊，右「立即报名」暖棕渐变大胶囊 */
.detail-page .k-bottom { background: #FFFFFF; border-top-color: rgba(160, 120, 80, .14); box-shadow: 0 -6px 18px rgba(120, 84, 48, .08); }
.team-button :deep(.k-button) { height: 48px; border: 1.5px solid #3A322B; color: #3A322B; font-size: 17px; font-weight: 700; letter-spacing: 1px; }
.apply-button :deep(.k-button) { font-family: var(--k-display-font); height: 48px; font-size: 17px; font-weight: 700; letter-spacing: 2px; }
.apply-button :deep(.k-button.is-primary) { background: linear-gradient(135deg, #8E5E37 0%, #6E4628 100%); box-shadow: 0 6px 14px rgba(110, 70, 40, .28); }
/* 名额已满 / 已暂停 / 已过截止时间时按钮点不了：之前暖棕渐变盖住了按钮自带的灰底，浅灰字压在棕色上几乎看不见，也不像点不了 */
.apply-button :deep(.k-button.is-primary.is-disabled) { background: #ECE5DC; box-shadow: none; color: #A39A92; }
/* 没加载完时「找人一起去」也要看得出点不了 */
.team-button :deep(.k-button.is-disabled) { border-color: #DDD3C8; color: #A39A92; }
/* 详情还没拿到时的提示 */
.detail-state { min-height: 320px; padding: 48px 28px; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; text-align: center; }
.detail-state__title { font-size: 16px; font-weight: 600; color: #3A322B; }
.detail-state__text { font-size: 13px; line-height: 1.6; color: #8A7A6A; }
.detail-state__retry { margin-top: 8px; min-height: 40px; padding: 0 24px; border: 1px solid #8E5E37; border-radius: 20px; color: #6E4628; font-size: 14px; font-weight: 600; display: flex; align-items: center; }
/* 顶部照片（V49）：可以左右滑，右下角写第几张 / 共几张 */
.hero { position: relative; height: 200px; background: var(--k-paper2); }
.hero__swiper { width: 100%; height: 200px; }
.hero__img { width: 100%; height: 200px; display: block; }
.hero__badge { position: absolute; left: 12px; top: 12px; }
.hero__count { position: absolute; right: 14px; bottom: 10px; padding: 2px 8px; border-radius: 10px; color: #fff; background: rgba(0,0,0,.5); font-size: 11px; }
.overview-body { padding: 12px 16px 100px; }
.overview-body .plain-card, .overview-body .section-card { margin: 10px 0 0; }
.overview-body .plain-card__list, .overview-body .section-row__value { font-size: 13px; }
.overview-body .section-row__label { width: 72px; font-size: 13px; }
.overview-title { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 21px; font-weight: 700; }
.overview-title>text { flex: 1; min-width: 0; }
.overview-flags { margin-top: 10px; display: flex; align-items: center; justify-content: space-between; }
.safe { height: 26px; padding: 0 10px; border-radius: 7px; background: var(--k-green-soft); color: var(--k-green); display: flex; align-items: center; gap: 4px; font-size: 13px; }
.favorite.is-busy, .sp-heading__favorite.is-busy { opacity: .6; }
.favorite { margin-left: auto; display: flex; align-items: center; gap: 5px; color: var(--k-muted); }
.info-card { margin-top: 12px; padding: 12px; border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-paper); }
.info-row { min-height: 37px; display: flex; align-items: center; gap: 10px; }
.info-row__label { width: 72px; color: var(--k-muted); font-size: 13px; }
.info-row__value { flex: 1; min-width: 0; font-size: 13px; word-break: break-all; }
.info-row__map { flex: 0 0 auto; color: var(--k-red); font-size: 12px; }
.info-row--tap:active { opacity: .7; }
.section-card, .plain-card { margin-bottom: 8px; padding: 12px; border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-paper); }
.section-card__title, .plain-card__title { display: block; margin-bottom: 6px; font-size: 16px; font-weight: 700; }
.section-row { min-height: 29px; display: flex; align-items: center; gap: 7px; }
.section-row__label { width: 96px; color: var(--k-muted); font-size: 12px; }
.section-row__value { flex: 1; min-width: 0; font-size: 12px; word-break: break-all; }
.plain-card__list { display: block; font-size: 12px; line-height: 1.55; white-space: pre-line; }
.team-button { width: 43%; flex: 0 0 auto; }
.apply-button { flex: 1; }
/* 门店卡片（关注门店，V37） */
.store-card { margin-top: 10px; padding: 10px 12px; border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-paper); display: flex; align-items: center; gap: 10px; }
.store-card__cover { width: 44px; height: 44px; border-radius: 8px; flex: 0 0 auto; }
.store-card__main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.store-card__name { font-size: 15px; font-weight: 700; color: var(--k-ink); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.store-card__meta { font-size: 12px; color: var(--k-muted); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
/* 不能报名的原因（暂停、名额已满、线上任务已过截止时间等） */
.blocked-tip { margin-top: 10px; padding: 9px 12px; border: 1px solid rgba(192, 68, 55, .28); border-radius: 10px; background: var(--k-alert-soft); color: var(--k-alert); display: flex; align-items: center; gap: 8px; font-size: 13px; line-height: 1.5; }
.blocked-tip > text { flex: 1; min-width: 0; }
/* 换工类型标签、线上任务须知入口 */
.overview-kind { margin-top: 8px; display: flex; align-items: center; gap: 8px; }
.redpacket-tag { height: 24px; padding: 0 9px; border-radius: 6px; background: var(--k-red-soft); border: 1px solid var(--k-red-line); color: var(--k-red-deep); font-size: 12px; font-weight: 600; display: flex; align-items: center; white-space: nowrap; }
.guide-link { margin-top: 10px; min-height: 46px; padding: 0 12px; border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-paper); display: flex; align-items: center; gap: 8px; }
.guide-link__title { font-size: 14px; font-weight: 700; color: var(--k-ink); }
.guide-link__sub { flex: 1; min-width: 0; font-size: 12px; color: var(--k-muted); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
/* ---------------- 线下岗位「门店页」（2026-10-18 改版；10-19 按参考图「岗位详情」一比一还原）----------------
   参考图的视觉：页面极浅暖米底；白卡 12 圆角 + 1px 暖色细边 + 很柔的阴影；「换工要求 / 工作内容 / 福利 / 保障」是浅暖米渐变卡，
   左上角深棕页签头；标题超粗深棕；圆点是橙色；评分、成本这类数字用暖橙棕。 */
.sp { padding-bottom: 8px; }
.sp-hero { position: relative; margin: 6px 12px 0; height: 146px; padding: 2px; border-radius: 14px; overflow: hidden; background: #FFFFFF; display: flex; gap: 3px; box-shadow: 0 6px 18px rgba(120, 84, 48, .12), inset 0 0 0 1px rgba(160, 120, 80, .14); box-sizing: border-box; }
.sp-hero__main { flex: 1; min-width: 0; height: 100%; border-radius: 12px; overflow: hidden; }
.sp-hero--grid .sp-hero__main { flex: 0 0 55%; border-radius: 12px 0 0 12px; }
.sp-hero__img { width: 100%; height: 100%; display: block; background: #EFE6DA; }
.sp-hero__grid { flex: 1; min-width: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-rows: repeat(2, minmax(0, 1fr)); gap: 3px; border-radius: 0 12px 12px 0; overflow: hidden; }
.sp-hero__grid--1 .sp-hero__cell { grid-column: 1 / 3; grid-row: 1 / 3; }
.sp-hero__grid--2 .sp-hero__cell { grid-column: 1 / 3; }
.sp-hero__cell--wide { grid-column: 1 / 3; }
.sp-hero__cell { position: relative; min-width: 0; min-height: 0; overflow: hidden; }
.sp-hero__more { position: absolute; left: 0; top: 0; right: 0; bottom: 0; background: rgba(36, 27, 23, .45); color: #fff; font-size: 17px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
/* 版式 1b：左大、中、右小三张并排（多的照片点开大图里翻），底部一条白字采访说明 */
.sp-hero--trio.sp-hero--grid .sp-hero__main { flex: 0 0 35%; }
.sp-hero--trio .sp-hero__grid { display: flex; }
.sp-hero--trio .sp-hero__cell { flex: 1 1 0; height: 100%; }
.sp-hero--trio .sp-hero__cell + .sp-hero__cell { flex: 1 1 0; }
.sp-hero--trio .sp-hero__cell:nth-child(n+3) { display: none; }
.sp-hero__caption { position: absolute; left: 2px; right: 2px; bottom: 2px; height: 34px; padding: 10px 12px 0; border-radius: 0 0 12px 12px; background: linear-gradient(180deg, rgba(36, 27, 23, 0) 0%, rgba(36, 27, 23, .62) 100%); color: #fff; font-size: 13px; font-weight: 700; letter-spacing: .3px; display: flex; align-items: center; justify-content: flex-end; text-shadow: 0 1px 2px rgba(0, 0, 0, .35); }
.sp-hero__badge { position: absolute; left: 10px; top: 10px; }
/* 右上角：「平台岗检」灰绿半透明胶囊 + 收藏（和标题旁的星标同一个状态）；收藏后换成白底赭黄星 */
.sp-hero__tr { position: absolute; right: 10px; top: 10px; display: flex; align-items: center; gap: 6px; }
.sp-hero__check, .sp-hero__fav { height: 24px; border-radius: 12px; color: #fff; font-size: 12px; font-weight: 700; display: flex; align-items: center; gap: 3px; white-space: nowrap; }
.sp-hero__check { padding: 0 9px 0 7px; background: rgba(88, 98, 72, .62); box-shadow: inset 0 0 0 .5px rgba(255, 255, 255, .35); }
.sp-hero__fav { padding: 0 9px 0 7px; background: rgba(36, 27, 23, .46); }
.sp-hero__fav.on { background: rgba(255, 255, 255, .95); color: var(--k-ochre-deep); box-shadow: 0 2px 8px rgba(58, 50, 43, .18); }
.sp-body { padding: 0 12px 16px; }
/* 标题：超粗深棕（k-display），右边圆形描边星标 */
.sp-title { margin-top: 11px; display: flex; align-items: center; gap: 10px; }
.sp-heading__subscribe { flex: 0 0 auto; max-width: 96px; }
.sp-tagline { display: flex; align-items: center; gap: 8px; margin-top: 6px; }
.sp-tagline .sp-tags { min-width: 0; }
.sp-tagline .sp-heading__favorite { margin-left: auto; min-width: 44px; min-height: 44px; }
.sp-title__text { flex: 1; min-width: 0; font-family: var(--k-sans); font-size: 24px; line-height: 1.25; color: #3B2A1E; word-break: break-all; }
.sp-fav { flex: 0 0 auto; width: 36px; height: 36px; border-radius: 50%; border: 1.5px solid #B9AEA4; background: rgba(255, 255, 255, .7); display: flex; align-items: center; justify-content: center; box-sizing: border-box; }
.sp-fav.on { background: var(--k-ochre-soft); border-color: var(--k-ochre); }
/* 标签条：浅橙底胶囊，前面一个橙色圆底对勾，「|」分隔 */
.sp-tags { margin-top: 8px; max-width: 100%; display: inline-flex; align-items: center; flex-wrap: wrap; row-gap: 4px; padding: 4px 12px 4px 5px; border-radius: 14px; background: linear-gradient(90deg, #FBE6CF 0%, #FCEFE0 100%); color: #6B4428; font-size: 14px; font-weight: 700; box-sizing: border-box; }
.sp-tags__icon { flex: 0 0 auto; width: 17px; height: 17px; margin-right: 6px; border-radius: 50%; background: linear-gradient(135deg, #F0A35A 0%, #DB8233 100%); display: flex; align-items: center; justify-content: center; }
.sp-tags__item { line-height: 18px; white-space: nowrap; }
.sp-tags__item--sep { margin-left: 7px; padding-left: 7px; border-left: 1.5px solid rgba(107, 68, 40, .35); }
.sp-tags__item--muted { color: var(--k-muted); }
.sp .blocked-tip { margin-top: 10px; border-radius: 12px; background: #FFF6F4; border-color: rgba(192, 68, 55, .45); }
/* 版式 1b 的标题区：左标题 + 「兼职岗位｜城市」，右状态胶囊；下一行绿色「安心商家」+ 收藏 */
.sp-pthead { margin-top: 14px; display: flex; align-items: flex-start; gap: 10px; }
.sp-pthead__main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.sp-pthead .sp-title__text { font-size: 23px; }
.sp-pthead__sub { font-size: 14px; color: #8A817A; }
.sp-pthead__state { flex: 0 0 auto; margin-top: 4px; height: 26px; padding: 0 12px; border-radius: 13px; background: #E9F2E2; color: #3F6B33; font-size: 13px; font-weight: 700; line-height: 26px; white-space: nowrap; }
.sp-pthead__state--off { background: #FCEBD8; color: #A0632E; }
.sp-ptflags { margin-top: 10px; display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.sp-safe { height: 26px; padding: 0 11px 0 4px; border-radius: 13px; background: #E6F0DE; color: #3F6B33; font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 5px; }
.sp-safe__tick { width: 18px; height: 18px; border-radius: 50%; background: #4F8A45; display: flex; align-items: center; justify-content: center; }
.sp-ptfav { margin-left: auto; height: 30px; padding: 0 12px 0 10px; border-radius: 15px; border: 1px solid #D9CFC4; background: rgba(255, 255, 255, .8); color: #5A5149; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 4px; box-sizing: border-box; }
.sp-ptfav.on { border-color: var(--k-ochre); background: var(--k-ochre-soft); color: var(--k-ochre-deep); }
/* 卡片：白底、12 圆角、1px 暖色细边 + 很柔的阴影（参考图） */
.sp-card { position: relative; margin-top: 7px; padding: 10px 11px; border-radius: 7px; background: #FFFFFF; border: 1px solid #C9B7A6; box-shadow: 0 1px 3px rgba(120,84,48,.035); box-sizing: border-box; }
/* 浅暖米渐变卡：「换工要求」「招募信息」「工作内容」 */
.sp-card--tint { background: linear-gradient(180deg, #F6ECE0 0%, #FBF6F0 100%); border-color: rgba(160, 120, 80, .26); box-shadow: 0 6px 18px rgba(120, 84, 48, .07), inset 0 1px 0 rgba(255, 255, 255, .7); overflow: hidden; }
/* 暖色卡：「福利」「袋鼠安心保障」 */
.sp-card--warm { background: linear-gradient(180deg, #F4E6D6 0%, #FAF3EA 100%); border-color: rgba(160, 120, 80, .26); }
/* 深棕页签头：贴着卡片左上角往里缩一点，圆角小块 */
.sp-tab { font-family: var(--k-display-font); display: inline-flex; align-items: center; height: 30px; margin: -6px 0 6px -6px; padding: 0 14px; border-radius: 8px; background: linear-gradient(135deg, #6E4A2E 0%, #946238 100%); box-shadow: 0 3px 8px rgba(110, 74, 46, .25); color: #fff; font-size: 16px; font-weight: 700; letter-spacing: 1px; }
.sp-h { display: block; font-family: var(--k-sans); font-size: 16px; font-weight: 700; line-height: 1.35; color: #3B2A1E; }
.sp-sub { display: block; margin-top: 8px; font-size: 16px; font-weight: 700; color: #3B2A1E; }
.sp-section { display: block; margin: 16px 2px 0; font-size: 18px; font-weight: 700; color: #3B2A1E; }
.sp-bullet { margin-top: 4px; display: flex; gap: 6px; font-size: 13px; line-height: 1.6; color: #5A4636; }
.sp-bullet__dot { flex: 0 0 auto; color: #E08A3A; font-weight: 900; font-size: 16px; line-height: 20px; }
.sp-bullet__text { flex: 1; min-width: 0; word-break: break-all; }
.sp-bullet__k { color: #5A3A22; font-weight: 700; }
.sp-link { flex: 0 0 auto; align-self: center; height: 22px; padding: 0 8px; border-radius: 11px; border: 1px solid rgba(160, 99, 46, .45); background: #FFF9F2; color: #8A5A30; font-size: 11px; font-weight: 700; line-height: 20px; white-space: nowrap; box-sizing: border-box; }
.sp-note { display: block; margin-top: 6px; font-size: 11px; color: #A39A92; text-align: center; }
.sp-loc { display: flex; align-items: center; gap: 10px; }
.sp-loc__copy { flex: 1; min-width: 0; }
.sp-loc__addr { display: block; margin-top: 4px; font-size: 14px; font-weight: 500; line-height: 1.5; color: #3A322B; word-break: break-all; }
/* 小地图：不放地图图片，浅灰底 + 两道青绿弧线小路 + 一道浅杏大路 + 深色定位针（参考图样子） */
.sp-map { position: relative; flex: 0 0 auto; width: 104px; height: 60px; border-radius: 10px; overflow: hidden; border: 1px solid #E4E1E6; background: #EDECF0; box-sizing: border-box; }
.sp-map__road { position: absolute; }
.sp-map__road--a { left: -14px; top: 30px; width: 70px; height: 10px; background: #F3E3C9; transform: rotate(28deg); }
.sp-map__road--b { left: 52px; top: -6px; width: 3px; height: 80px; background: #FFFFFF; transform: rotate(-28deg); }
.sp-map__ring { position: absolute; left: 14px; top: 8px; width: 120px; height: 90px; border-radius: 50%; border: 2px solid #8FD0CB; border-right-color: transparent; border-bottom-color: transparent; box-sizing: border-box; }
.sp-map__pin { position: absolute; left: 62px; top: 12px; width: 20px; height: 20px; border-radius: 50% 50% 50% 0; background: #2F2A26; transform: rotate(-45deg); box-shadow: 0 2px 4px rgba(0, 0, 0, .25); display: flex; align-items: center; justify-content: center; }
.sp-map__pin-dot { width: 7px; height: 7px; border-radius: 50%; background: #fff; }
.sp-map__tag { position: absolute; right: 3px; bottom: 3px; padding: 0 4px; border-radius: 4px; background: rgba(255, 255, 255, .92); color: #8A5A30; font-size: 11px; line-height: 15px; }
/* 交通参考：浅米底圆角框里两条圆点 */
.sp-trip { margin-top: 8px; padding: 6px 10px 8px; border-radius: 10px; background: #F8F3EC; border: 1px solid rgba(160, 120, 80, .1); }
.sp-trip .sp-bullet { font-size: 12px; line-height: 1.6; }
/* 采访视频：白边框卡，左上棕色胶囊标题，中央播放钮，底部白字；下面压一个「已完成线下实地核验」棕色小胶囊 */
.sp-video { margin-top: 10px; }
.sp-video__cover { position: relative; width: 100%; height: 0; padding-bottom: 35%; border-radius: 12px; overflow: hidden; background: #DDD5C8; border: 2px solid #FFFFFF; box-shadow: 0 6px 18px rgba(120, 84, 48, .12), 0 0 0 1px rgba(160, 120, 80, .2); box-sizing: content-box; }
.sp-video__img { position: absolute; left: 0; top: 0; width: 100%; height: 100%; }
.sp-video__shade { position: absolute; left: 0; right: 0; bottom: 0; height: 55%; background: linear-gradient(180deg, rgba(36, 27, 23, 0) 0%, rgba(36, 27, 23, .66) 100%); }
.sp-video__title { position: absolute; left: 10px; top: 10px; height: 26px; padding: 0 11px 0 8px; border-radius: 13px; background: rgba(110, 72, 42, .86); box-shadow: inset 0 0 0 .5px rgba(255, 255, 255, .3); color: #fff; font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 4px; white-space: nowrap; }
.sp-video__play { position: absolute; left: 50%; top: 50%; width: 46px; height: 46px; margin: -23px 0 0 -23px; padding-left: 3px; border-radius: 50%; background: rgba(36, 27, 23, .35); border: 1.5px solid rgba(255, 255, 255, .9); display: flex; align-items: center; justify-content: center; box-sizing: border-box; }
.sp-video__cap { position: absolute; left: 10px; right: 10px; bottom: 10px; color: #fff; font-size: 13px; font-weight: 700; line-height: 1.45; text-align: center; text-shadow: 0 1px 2px rgba(0, 0, 0, .3); }
.sp-video__chiprow { position: relative; margin-top: -10px; display: flex; justify-content: center; }
.sp-video__chip { height: 22px; padding: 0 14px; border-radius: 11px; border: 1.5px solid #FFFFFF; background: linear-gradient(135deg, #C09060 0%, #9A6B3F 100%); box-shadow: 0 2px 6px rgba(120, 84, 48, .25); color: #fff; font-size: 12px; font-weight: 700; display: flex; align-items: center; white-space: nowrap; }
/* 所有要求两列横排，长文案完整换行。 */
.sp-reqs { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 16px; align-items: start; }
.sp-reqs .sp-bullet { width: auto; min-width: 0; margin: 0; font-size: 14px; line-height: 1.65; }
/* 加粗的标签后面不写冒号，空一点再接内容 */
.sp-reqs .sp-req-k { padding-right: 6px; color: var(--k-red-deep); font-weight: 700; white-space: nowrap; }
/* 招募信息三栏 */
.sp-stats { padding: 12px 6px; }
.sp-stats__row { display: flex; }
.sp-stat { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; }
.sp-stat--sep { border-left: 1px solid rgba(160, 120, 80, .22); }
.sp-stat__k { font-size: 14px; color: #6B4A30; }
.sp-stat__v { font-family: var(--k-display-font); font-size: 17px; font-weight: 700; color: #3B2A1E; word-break: break-all; }
/* 工作内容（左，深棕页签头 + 列表）| 工作时间（右，大字） */
.sp-work { display: flex; gap: 10px; }
.sp-work__list { flex: 1; min-width: 0; }
.sp-work__list .sp-bullet { color: #6B4428; font-weight: 700; }
.sp-work__time { flex: 0 0 106px; margin: -10px -11px -10px 0; padding: 10px 8px; border-left: 1px solid rgba(160, 120, 80, .2); background: rgba(255, 255, 255, .35); display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; }
.sp-work__time--full { flex: 1; margin: 0; padding: 0; border-left: 0; background: transparent; align-items: flex-start; text-align: left; }
/* 工作时间的页签头和「工作内容」同一个样子（2026-11-03 主人）：在右边窄栏里居中，不往左上角缩 */
.sp-work__tab { margin: -6px 0 0; padding: 0 12px; letter-spacing: 0; }
.sp-work__time--full .sp-work__tab { margin-left: -6px; }
.sp-work__hours { font-family: var(--k-display-font); font-size: 18px; font-weight: 900; color: #8A5A30; word-break: break-all; }
.sp-work__rest { font-family: var(--k-display-font); display: flex; align-items: center; gap: 4px; color: #8A5A30; font-size: 15px; font-weight: 900; }
.sp-work__rest > text { min-width: 0; word-break: break-all; }
/* 门店写的排班说明 / 上班时段（「每周 5 天，每天 6 小时」「9:00-12:00，15:00-18:00」）：小字另起一行，不和上面两行大字抢 */
.sp-work__note { font-size: 12px; line-height: 1.5; color: #8A6A4E; font-weight: 700; word-break: break-all; }
/* 福利：两个白底小卡并排；版式 1b 是深棕标题头 + 大字对勾 */
.sp-perks { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 8px; }
.sp-perk { flex: 1 1 40%; min-width: 0; padding: 6px 10px; border-radius: 8px; border: 1px solid rgba(160, 120, 80, .22); background: rgba(255, 255, 255, .85); color: #5A3A22; font-size: 13px; font-weight: 700; line-height: 1.4; text-align: center; word-break: break-all; display: flex; align-items: center; justify-content: center; gap: 6px; }
.sp-welfare__items { margin-top: 4px; }
.sp-welfare--pt { padding-top: 0; overflow: hidden; }
.sp-welfare__bar { font-family: var(--k-display-font); margin: -10px -11px 8px; height: 38px; padding: 0 14px; background: linear-gradient(135deg, #6E4A2E 0%, #946238 100%); color: #fff; font-size: 17px; font-weight: 700; letter-spacing: 1px; display: flex; align-items: center; }
.sp-welfare--pt .sp-perk { font-family: var(--k-display-font); padding: 10px 8px; border: 0; border-radius: 0; background: transparent; justify-content: flex-start; font-size: 17px; font-weight: 900; color: #5A3A22; text-align: left; }
.sp-welfare--pt .sp-perk + .sp-perk { border-left: 1px solid rgba(160, 120, 80, .22); padding-left: 14px; }
.sp-perk__tick { flex: 0 0 auto; width: 18px; height: 18px; border-radius: 50%; background: linear-gradient(135deg, #F0A35A 0%, #DB8233 100%); display: flex; align-items: center; justify-content: center; }
/* 住宿环境、店里的宠物：一句话 + 图格（年纪大的人也看得清，不跟版式里的小字走） */
.sp-extra__line { display: block; margin-top: 4px; font-size: 14px; line-height: 1.5; color: #604B40; }
/* 店长介绍：大圆头像（白圈 + 阴影）、超粗名字、浅橙评分胶囊 */
.sp-mgr { margin-top: 7px; display: flex; align-items: flex-start; gap: 10px; }
.sp-mgr__avatar { flex: 0 0 auto; width: 65px; height: 65px; border-radius: 50%; border: 3px solid #FFFFFF; box-shadow: 0 3px 10px rgba(120, 84, 48, .2); background: #EFE6DA; }
.sp-mgr__copy { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.sp-mgr__name { font-size: 18px; font-weight: 700; color: #3B2A1E; }
.sp-mgr__line { font-size: 13px; line-height: 1.55; color: #4A3E35; word-break: break-all; }
.sp-mgr__rating { margin-top: 6px; height: 24px; padding: 0 14px; border-radius: 14px; background: linear-gradient(90deg, #FBE6CF 0%, #FCF1E4 100%); color: #8A5A30; font-size: 13px; font-weight: 600; display: inline-flex; align-items: center; gap: 5px; }
.sp-mgr__score { font-family: var(--k-display-font); font-size: 16px; font-weight: 900; }
/* 该店亮点：3×2 浅灰格子，彩色立体小图标在上、文字在下；版式 1b 一行六个 */
.sp-fac { margin-top: 10px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
.sp-fac--row { grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 4px; }
.sp-fac__item { height: 54px; border-radius: 8px; background: linear-gradient(180deg, #F1EFF3 0%, #EEECF0 100%); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; }
.sp-fac--row .sp-fac__item { height: 58px; }
.sp-fac__img { width: 36px; height: 27px; }
.sp-fac__label { max-width: 100%; padding: 0 4px; box-sizing: border-box; font-size: 13px; font-weight: 600; color: #3A322B; text-align: center; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.sp-fac--row .sp-fac__label { padding: 0 1px; font-size: 11px; }
/* 用户反馈 + 店里日常：两张卡并排，只有一张时占满 */
.sp-pair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; align-items: stretch; }
.sp-pair--one { grid-template-columns: minmax(0, 1fr); }
.sp-pair > .sp-card { min-width: 0; padding: 11px 10px; }
.sp-pair--one > .sp-card { padding: 13px 14px; }
.sp-half__head { display: flex; align-items: center; gap: 5px; }
.sp-fbk__head { display: flex; align-items: center; gap: 6px; }
.sp-fbk__head .sp-h { flex: 1; min-width: 0; }
.sp-fbk__score { flex: 0 0 auto; display: flex; align-items: center; gap: 2px; }
.sp-fbk__num { font-family: var(--k-display-font); font-size: 15px; font-weight: 900; line-height: 1; color: #A0632E; }
.sp-fbk__meta { margin-left: 2px; font-size: 11px; color: #8A817A; white-space: nowrap; }
.sp-rv { margin-top: 6px; padding: 5px 8px 6px 4px; border-radius: 8px; background: #F8F2EB; display: flex; gap: 3px; }
.sp-rv__main { flex: 1; min-width: 0; }
.sp-rv__text { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; font-size: 12px; line-height: 1.6; color: #4A3E35; }
.sp-rv__top { margin-top: 2px; display: flex; align-items: center; gap: 5px; min-width: 0; }
.sp-rv__name { min-width: 0; font-size: 11px; color: #8A817A; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.sp-rv__days { flex: 0 0 auto; font-size: 11px; color: #A0632E; }
.sp-rv__stars { flex: 0 0 auto; display: flex; gap: 1px; }
.sp-fbk__none { display: block; margin-top: 8px; font-size: 12px; line-height: 1.6; color: var(--k-muted); }
.sp-fbk__write { margin-top: 8px; min-height: 32px; padding: 4px 8px; border-radius: 10px; background: #FCEBD8; display: flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 700; line-height: 1.4; color: #8A5A30; }
.sp-fbk__write > text { flex: 1; min-width: 0; }
.sp-fbk__all { margin-top: 8px; display: flex; align-items: center; justify-content: center; gap: 1px; font-size: 12px; font-weight: 700; color: #8A5A30; }
/* 店里日常：占满一行时 4 张方图；并排时左宽右窄两张（更多的写 +N） */
.sp-daily { margin-top: 10px; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
.sp-daily--pair { grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); gap: 5px; }
.sp-daily--pair .sp-daily__cell:nth-child(n+3) { display: none; }
.sp-daily__cell { position: relative; height: 0; padding-bottom: 100%; border-radius: 8px; overflow: hidden; background: #EFE6DA; }
.sp-daily--pair .sp-daily__cell { height: 94px; padding-bottom: 0; }
.sp-daily__img { position: absolute; left: 0; top: 0; width: 100%; height: 100%; }
.sp-daily__more { position: absolute; left: 0; top: 0; right: 0; bottom: 0; background: rgba(36, 27, 23, .45); color: #fff; font-size: 15px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
/* 袋鼠安心保障：暖色卡里一块更浅的面板放三条；保险那句橙棕加粗，执照是一个描边小按钮 */
.sp-assure__panel { margin-top: 8px; padding: 4px 10px 8px; border-radius: 10px; background: rgba(255, 255, 255, .55); border: 1px solid rgba(160, 120, 80, .12); }
.sp-assure__panel .sp-bullet { align-items: flex-start; }
.sp-assure__hl { color: #A0632E; font-weight: 700; }
/* 门店卡：左边方形封面（没有封面时灰色描边图标块）、超粗店名、右边描边「+ 关注」胶囊 */
.sp .store-card { margin-top: 10px; padding: 12px 14px; border: 1px solid rgba(160, 120, 80, .18); border-radius: 12px; box-shadow: 0 6px 18px rgba(120, 84, 48, .07); }
.sp .store-card__cover { width: 52px; height: 52px; border-radius: 10px; border: 1px solid #E4DDD5; box-sizing: border-box; }
.store-card__cover--empty { background: #F7F4F0; display: flex; align-items: center; justify-content: center; }
.sp .store-card__name { font-size: 17px; color: #3B2A1E; }
.store-card__sub { font-size: 13px; color: #5A5149; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.store-card__follow { flex: 0 0 auto; }
.store-card__follow :deep(.k-button) { height: 30px; padding: 0 14px; font-size: 13px; font-weight: 700; color: #3A322B; border-color: #9C948C; }
.store-card__follow :deep(.k-button.is-disabled) { color: var(--k-light); }
/* 版式 1b：招募信息表（两行三列）+ 内嵌位置与交通 */
.sp-recruit__table { margin-top: 8px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border-radius: 10px; overflow: hidden; border: 1px solid rgba(160, 120, 80, .2); border-bottom: 0; background: #FBF6F0; }
.sp-recruit__cell { min-width: 0; padding: 8px 6px; display: flex; flex-direction: column; align-items: center; gap: 3px; text-align: center; border-right: 1px solid rgba(160, 120, 80, .16); border-bottom: 1px solid rgba(160, 120, 80, .16); }
.sp-recruit__cell:nth-child(3n) { border-right: 0; }
/* 只有一两格时按格数均分，不留空格子 */
.sp-recruit__table--1 { grid-template-columns: minmax(0, 1fr); }
.sp-recruit__table--2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.sp-recruit__table--1 .sp-recruit__cell, .sp-recruit__table--2 .sp-recruit__cell:nth-child(2n) { border-right: 0; }
.sp-recruit__k { font-size: 12px; color: #8A6A4E; }
.sp-recruit__v { font-family: var(--k-display-font); font-size: 15px; font-weight: 700; color: #3B2A1E; word-break: break-all; }
.sp-loc--inner { margin-top: 12px; padding-top: 12px; border-top: 1px dashed rgba(160, 120, 80, .25); }
.sp-recruit .sp-trip { background: #F4F2EF; }
@import "./detail-training.scss";
@import "detail-premium.scss";
@import "detail-volunteer-reference.scss";
/* Latest acceptance follows the supplied reference proportions. */
</style>
