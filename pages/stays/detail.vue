<template>
  <k-feature-gate feature="stay-booking">
  <view class="k-page stay-detail" :class="[$userSurface, { 'vlog-page': s === 4, 'stay-detail--solid': barSolid || s !== 1 }]" :style="{ '--stay-paper': 'url(' + STAY_ART.paper + ')' }">
    <!-- 概览屏（s=1）是沉浸式头图：顶栏透明叠在图上，往下滑过头图后才铺底色、出标题 -->
    <!-- 2026-10-18 效果图：顶栏透明时返回箭头旁边一颗半透明白底的「房源详情」标题胶囊，滑过头图后换回普通标题 -->
    <k-topbar :title="s === 1 ? '' : (s === 4 ? 'Vlog 详情' : '房源详情')" back :dark="s === 4" :bg="s === 4 ? '#151311' : (s === 1 && !barSolid ? 'transparent' : '#FAF4EF')" custom-back @back="onBack">
      <template #left><view v-if="s === 1 && !barSolid" class="bar-pill" :style="pillStyle"><text>房源详情</text></view><text v-else-if="s === 1" class="bar-title" :style="pillStyle">房源详情</text></template>
      <template #right><view /></template>
    </k-topbar>

    <!-- 2026-10-17 改版（效果图 7，只做现有数据撑得起的部分）：满屏大图（有多张图时左右滑）→ 叠上来的白色信息卡（名称、来源 / 安心住 / 亮点标签、
         评分或「暂无家人评价」、起价 +「N种房型可选」、地址卡）→ 小院主理人 → 住过的家人评价（有 Vlog 时并排一个 Vlog 入口）→ 可选空余房型（点「选择」选中）
         → 底部「已选：房型 | 日期 | N晚」+ 立即预订。3 分钟看小院视频、生活碎片要等下一批数据，现在不出现。
         2026-10-17 R2：加了「出行参考」卡（员工手填的优点 / 缺点 / 机场 / 高铁）和主理人的年龄 / 籍贯 / 擅长、主理人评分
         2026-10-17 R3：「3分钟看小院」视频卡（员工端上传了小院视频才出现）、「近期生活碎片」入口（有显示中的生活碎片才出现，和「住过的家人评价」并排）、
         房型卡的「≤1分钟」短视频（点图上的播放按钮全屏播放，点卡片其他地方照旧是选房型）；「住过的家人评价」入口改到新的小院评价页 -->
    <view v-if="s === 1" class="overview k-pad-bottom">
      <view class="hero-box" :style="'margin-top: -' + barHeight + 'px'">
        <swiper v-if="gallery.length > 1" class="hero" circular @change="onHero"><swiper-item v-for="(img, i) in gallery" :key="img + i"><image class="hero" :src="absUrl(img)" mode="aspectFill" @click="previewHero(i)" /></swiper-item></swiper>
        <image v-else class="hero" :src="absUrl(d.cover) || '/static/media/cover-empty.png'" mode="aspectFill" @click="previewHero(0)" />
        <view class="hero-fade" />
        <view class="hero-actions" :style="'top:' + (barHeight + 8) + 'px'">
          <view class="hero-action" aria-label="收藏房源" @click="toggleFavorite"><k-icon name="heart" :size="16" :color="d.favorite ? 'red' : 'ink'" :fill="!!d.favorite" /></view>
          <view class="hero-actions__line" />
          <view class="hero-action" aria-label="分享房源" @click="shareTip"><k-icon name="share-2" :size="16" color="ink" /></view>
        </view>
        <text v-if="gallery.length > 1" class="hero-count">{{ heroIdx + 1 }}/{{ gallery.length }}</text>
      </view>
      <view class="info">
        <view class="title-row"><view><view><text>{{ d.stayName || loadError || '正在加载小院信息…' }}</text></view></view><view class="title-actions"><view aria-label="收藏房源" @click="toggleFavorite"><k-icon name="heart" :size="20" color="muted" :fill="!!d.favorite" /><text>{{ d.favorite ? '已收藏' : '收藏' }}</text></view><view aria-label="分享房源" @click="shareTip"><k-icon name="share-2" :size="20" color="muted" /><text>分享</text></view></view></view>
        <view v-if="loadError && canRetryDetail" class="rooms-state rooms-state--error detail-retry" role="status"><text v-if="d.stayName">{{ loadError }}</text><view class="rooms-state__retry" role="button" hover-class="k-press-s" @click="retryDetail"><text>{{ detailLoading ? '正在重新加载…' : '重新加载' }}</text></view></view>
        <view class="info-meta">
          <view class="info-meta__copy"><view v-if="infoChips.length" class="info-chips"><text v-for="c in infoChips" :key="c.text" class="ichip" :class="'ichip--' + c.tone">{{ c.text }}</text></view><view class="rating" @click="openReviews"><text>{{ ratingMain }}</text><text>{{ ratingSub }}</text><k-icon v-if="ratingMain" name="chevron-right" :size="12" color="muted" /></view></view>
          <view v-if="priceFrom" class="info-price"><view class="info-price__row"><text class="info-price__num">¥{{ priceFrom }}</text><text class="info-price__unit">7晚参考价起</text></view><view v-if="roomCount" class="info-price__pill info-price__link" hover-class="k-press-s" @click="toRooms"><text>{{ roomCount }}种房型可选</text><k-icon name="chevron-right" :size="12" color="red" /></view></view>
        </view>
        <text v-if="periodSummary.periodText" class="stay-period-options">{{ periodSummary.periodText }}</text><text class="week-price-note">7晚起订，按所选日期计价，最终金额可在确认订单时查看。</text>
        <view v-if="promo" class="info-promo"><k-chip tone="ochre" @click="openPromo"><text>{{ promoPrice ? '早鸟 ¥' + promoPrice + '/晚' : '早鸟价' }}</text></k-chip></view>
        <!-- 2026-10-16 主人反馈：之前只有右边小按钮能点；现在整张地址卡都能点（有地图位置打开地图选高德 / 腾讯导航，没有就复制带城市的地址） -->
        <view v-if="locationText || mapPoint" class="location" @click="openMap"><view class="location-pin"><k-icon name="map-pin" :size="14" color="red" /></view><view class="location-copy"><text v-if="d.areaDesc && d.address && d.areaDesc !== d.address" class="location-area">{{ d.areaDesc }}</text><text class="location-main">{{ locationText || '房源位置' }}</text></view><view v-if="locationText" class="location-action" hover-class="k-press-s" @click.stop="copyAddress"><k-icon name="copy" :size="12" color="red" /><text>复制地址</text></view></view>
      </view>
      <view class="overview-body">
        <view v-if="d.slogan || d.sloganSub" class="slogan"><view><text v-if="d.slogan">{{ d.slogan }}</text><text v-if="d.sloganSub">{{ d.sloganSub }}</text></view><image src="/static/media/stays-kangaroo-stamp.png" mode="aspectFit" /></view>
        <!-- 出行参考（2026-10-17 R2，效果图 7）：员工端 / 后台手填的优点、缺点、机场怎么到、高铁怎么到（主人拍板不接大模型，标题就叫「出行参考」，不写成自动总结），
             只显示填了的行，四行都没填时整张卡不出现 -->
        <view class="sec-card trip">
          <view class="sec-head"><text class="sec-title">出行参考</text></view>
          <view v-for="r in travel" :key="r.k" class="trip__row"><text class="trip__k" :class="'trip__k--' + r.tone">{{ r.k }}</text><text class="trip__v">{{ r.v }}</text></view>
          <text v-if="stayLoaded && !travel.length" class="section-pending">出行资料待主理人补充，可点击地址查看地图路线。</text>
        </view>
        <!-- 3分钟看小院（2026-10-17 R3，效果图 7）：宽封面 + 圆形播放按钮 + 一句说明；点了全屏播放。员工端没传小院视频时整张卡不出现 -->
        <view v-if="introVideo" class="sec-card vcard">
          <view class="sec-head vcard__head"><view class="vcard__title"><view class="vcard__dot"><k-icon name="play" :size="12" color="white" fill /></view><text class="sec-title">{{ INTRO_TITLE }}</text></view></view>
          <view class="vcard__cover" hover-class="k-press-s" @click="playVideo(introVideo, INTRO_TITLE)">
            <image v-if="introVideo.cover" class="vcard__img" :src="absUrl(introVideo.cover)" mode="aspectFill" />
            <view class="vcard__shade" />
            <view class="vcard__play"><k-icon name="play" :size="18" color="white" fill /></view>
            <text class="vcard__cap">{{ INTRO_CAPTION }}</text>
          </view>
        </view>
        <view v-else-if="stayLoaded" class="sec-card vcard vcard--pending">
          <view class="vcard__head"><text class="sec-title">小院影像</text></view>
          <view class="video-pending"><k-icon name="video" :size="22" color="red" /><text>主理人尚未上传小院视频</text></view>
        </view>
        <!-- 小院主理人：头像、称呼、年龄 / 籍贯 / 擅长（R2，填了才有）、小院评分、主理人评分（R2：评价里「服务」一项的平均分，带分项的评价满 3 条才有）、
             简介、小院故事；主理人什么都没填时整块不出现 -->
        <view v-if="hasHost" class="sec-card host2">
          <view class="sec-head"><text class="sec-title">当地主理人</text><view v-if="host.storeId" class="host2__follow" :class="{ on: following }" hover-class="k-press-s" @click="followHost"><text>{{ following ? '已关注' : '关注' }}</text></view></view>
          <view class="host2__main"><image class="host2__avatar" :src="absUrl(host.avatar) || '/static/media/profile-avatar.jpg'" mode="aspectFill" /><view class="host2__copy"><text class="host2__name">{{ host.name || '主理人' }}</text><view v-if="hostMeta.length" class="host2__facts"><text v-for="f in hostMeta" :key="f.k" class="host2__fact" :class="{ 'host2__fact--wide': f.k === '擅长' }">{{ f.k }} · {{ f.v }}</text></view><view v-if="ratingMain || hostScore" class="host2__scores"><text v-if="ratingMain" class="host2__score">小院评分 {{ ratingMain }}</text><text v-if="hostScore" class="host2__score">主理人评分 {{ hostScore }}</text></view><text v-if="host.intro" class="host2__intro">{{ host.intro }}</text></view></view>
          <view v-if="host.story" class="host2__story" hover-class="k-press" @click="showStory"><text class="host2__story-text">{{ host.story }}</text><view class="host2__more"><text>小院故事</text><k-icon name="chevron-right" :size="12" color="red" /></view></view>
          <view class="host-stats"><view class="host-stat"><text class="host-stat__num">{{ d.completedOrders || 0 }} 单</text><text class="host-stat__label">累计接待</text></view><text class="host-stat__rate">{{ goodRateText }}</text></view>
        </view>
        <view v-else-if="stayLoaded" class="sec-card host2 host2--pending"><view class="sec-head"><text class="sec-title">当地主理人</text></view><text class="section-pending">当地主理人介绍待补充</text></view>
        <view v-if="host.storeId" class="sec-card" role="button" hover-class="k-press" @click="go(R.stayShop + '?storeId=' + host.storeId)"><view class="sec-head"><text class="sec-title">门店增值服务</text><view class="sec-go"><text>查看服务</text><k-icon name="chevron-right" :size="12" color="muted" /></view></view><text class="section-pending">出行、餐饮与体验服务，可先浏览，入住期间预订</text></view>
        <view class="room-section">
        <!-- 评价和生活碎片并排；房型按第二张参考图纵向排列。 -->
        <view class="entries">
          <!-- 2026-10-18 主人：「住过的家人评价」左边一个整体总结分（按真实评价算的综合分，和评价页同一个数；没有评价时是一枚小星星） -->
          <view class="entry entry--reviews" hover-class="k-press-s" @click="openReviews">
            <view class="entry__score" :class="{ 'entry__score--none': !ratingMain && !reviewAi.ready }"><text class="entry__num">{{ reviewAi.score || ratingMain || '—' }}</text><text class="entry__score-label">{{ stayLoaded ? (reviewAi.ready ? 'AI综合评分' : (ratingMain ? '住客评分' : '暂无家人评价')) : (loadError ? '未加载' : '正在加载') }}</text></view>
            <view class="entry__copy"><text class="entry__title">住过的家人评价</text><text class="entry__sub">{{ reviewEntryText }}</text><text v-if="reviewAi.ready" class="entry__method">{{ reviewAi.summary }}</text></view><view class="entry__ic"><k-icon name="messages-square" :size="18" color="red" /></view>
            <k-icon name="chevron-right" :size="18" color="muted" />
          </view>
          <view class="entry entry--diary" hover-class="k-press-s" @click="openDiary"><view class="entry__copy"><text class="entry__title">{{ DIARY_TITLE }}</text><text class="entry__sub">{{ DIARY_SUB }}</text></view><view class="entry__ic"><k-icon name="camera" :size="18" color="red" /></view><k-icon name="chevron-right" :size="18" color="muted" /></view>
          <view v-if="vlogs.length" class="entry" hover-class="k-press-s" @click="s = 3"><view class="entry__copy"><text class="entry__title">小院 Vlog</text><text class="entry__sub">{{ vlogs.length }} 条视频</text></view><view class="entry__ic"><k-icon name="clapperboard" :size="18" color="red" /></view><k-icon name="chevron-right" :size="18" color="muted" /></view>
        </view>
        <!-- 进行中的活动留在详情页；往期活动在独立页面查看，没有进行中活动时只保留一行入口。 -->
        <view v-if="acts.current.length || acts.past.length" class="acts" :class="{ 'acts--entry': !acts.current.length }">
          <view class="acts__head">
            <view v-if="!acts.current.length" class="acts__ic"><k-icon name="calendar-days" :size="18" color="red" /></view><view class="acts__title"><text class="sec-title">小院活动</text><text v-if="!acts.current.length" class="acts__desc">看看小院以前办过的活动</text></view>
            <view v-if="acts.past.length" class="acts__toggle" role="button" aria-label="查看往期活动" hover-class="k-press" @click="openPastActivities"><text>往期活动</text><k-icon name="chevron-right" :size="12" color="red" /></view>
          </view>
          <scroll-view v-if="acts.current.length" class="acts__scroll" scroll-x :show-scrollbar="false" enhanced>
            <view class="acts__row">
              <view v-for="a in acts.current" :key="a.activityId" class="act" hover-class="k-press-s" @click="openActivity(a)">
                <view class="act__pic">
                  <image v-if="a.cover" class="act__img" :src="absUrl(a.cover)" mode="aspectFill" />
                  <text v-if="a.limited" class="act__limit">限时 · {{ a.left }}</text>
                  <text v-else-if="a.status" class="act__state">{{ a.status }}</text>
                </view>
                <view class="act__body">
                  <text class="act__title">{{ a.title }}</text>
                  <text v-if="a.when" class="act__when">{{ a.when }}</text>
                  <view class="act__foot"><text class="act__price" :class="{ 'act__price--free': a.free }">{{ a.price }}</text><text v-if="a.deadline" class="act__deadline">{{ a.deadline }}</text></view>
                </view>
              </view>
            </view>
          </scroll-view>
        </view>
        <!-- 可选空余房型：房型接口按所选日期算的起价、余量（只剩 1–3 间写「少量余房」）、能不能订；点卡片或「选择」选中，底部浮条跟着变 -->
        <view id="stay-rooms" class="sec-head rooms-head"><text class="sec-title">可选空余房型</text><view class="rooms-head__note" hover-class="k-press" @click="dateOpen = true"><text>{{ datesText }} · {{ nights }}晚 · {{ state.guests }}人</text><text class="rooms-head__edit">改日期</text><k-icon name="chevron-right" :size="12" color="red" /></view></view>
        <view v-if="!roomsLoading && !roomsError && roomsLoaded && !roomList.length" class="r3-empty-ic rooms-empty-ic"><k-icon name="bed-double" :size="28" color="red" /></view><view v-if="roomsLoading" class="rooms-state" role="status"><text>正在查询所选日期的价格与余量…</text></view>
        <view v-else-if="roomsError" class="rooms-state rooms-state--error" role="status"><text>{{ roomsError }}</text><view class="rooms-state__retry" role="button" @click="loadRooms">重新加载房型</view></view>
        <text v-else-if="roomsLoaded && !roomList.length" class="list-empty">暂无可订房型</text><text v-if="!roomsLoading && !roomsError && roomsLoaded && !roomList.length" class="rooms-empty-sub">可调整入住日期或人数，再看看有哪些房型。</text>
        <!-- 2026-10-18 效果图：每个房型一张全宽卡 —— 上面 16:9 大图（有短视频时是视频封面 + 播放钮、左上「≤1分钟」），
             下面房型名 + 该房型的真实评价入口、规格「1人｜独立卫浴｜空调」、价格、余量，右边绿色「选择」 -->
        <view v-if="roomList.length" class="room-stack">
        <view v-for="r in roomList" :key="r.roomTypeId" :data-room-id="r.roomTypeId" class="rt" :class="{ on: selRoomId === r.roomTypeId, off: !r.bookable }" hover-class="k-press-s" @click="pickRoom(r)">
          <view class="rt__pic">
            <image class="rt__img" :src="absUrl(r.video ? r.video.cover : r.cover) || '/static/media/cover-empty.png'" mode="aspectFill" />
            <text v-if="r.promoPrice" class="room__promo">早鸟 ¥{{ r.promoPrice }}/晚</text>
            <view v-if="r.video" class="rt__play" @click.stop="playVideo(r.video, r.name)"><view class="rt__play-dot"><k-icon name="play" :size="12" color="white" fill /></view><text class="rt__badge">{{ ROOM_VIDEO_BADGE }}</text></view>
          </view>
          <view class="rt__body">
            <view class="rt__top"><text class="rt__name">{{ r.name }}</text></view>
            <text v-if="r.line" class="rt__line">{{ r.line }}</text>
            <view v-if="r.ai.ready || r.rate" class="rt__review" :data-room-id="r.roomTypeId" hover-class="k-press-s" @click.stop="openRoomReviews(r)">
              <view v-if="r.ai.ready || r.rate" class="rt__rate"><k-icon name="star" :size="12" color="ochre" fill /><text class="rt__score">{{ r.ai.score || r.rate.score }}分</text><text class="rt__cnt">{{ r.ai.ready ? 'AI总结 · ' : '' }}{{ r.rate ? r.rate.count : r.ai.count }}条本房型评价</text></view>
              <text v-else class="rt__none">暂无该房型评价</text>
              <view class="rt__review-go"><text>查看评价</text><k-icon name="chevron-right" :size="12" color="red" /></view>
            </view>
            <view class="rt__foot">
              <view class="rt__left"><view class="rt__price"><text class="rt__yen">¥</text><text class="rt__num">{{ r.price }}</text><text class="rt__unit">{{ r.priceLabel }}</text></view><text v-if="r.periodText" class="stay-period-options">{{ r.periodText }}</text><text v-if="r.few" class="rt__few">少量余房</text><text v-else-if="!r.bookable" class="rt__few rt__few--off">{{ r.reason || '所选日期订不了' }}</text><text v-else class="rt__few rt__few--ok">{{ d.onlinePaymentAvailable === false ? '有房' : '可订' }}</text></view>
              <view class="rt__btn" :class="{ on: selRoomId === r.roomTypeId, off: !r.bookable }"><text>{{ !r.bookable ? '不可订' : (selRoomId === r.roomTypeId ? '已选' : '选择') }}</text></view>
            </view>
          </view>
        </view>
        </view>
        </view>
      </view>
    </view>

    <view v-else-if="s === 2" class="rooms-body k-pad-bottom">
      <view class="facilities"><view v-for="item in facilities" :key="item.label"><view class="fac-tile"><k-icon :name="item.icon" :art="item.art" :size="24" color="red" /></view><text>{{ item.label }}</text></view></view>
      <view class="host card"><view class="host-title"><text>{{ host.name ? '主理人 · ' + host.name : '主理人' }}</text><k-chip v-if="d.stayName" tone="ochre"><text>{{ srcLabel(d.operateMode) }}</text></k-chip></view><view class="host-main"><image :src="absUrl(host.avatar) || '/static/media/profile-avatar.jpg'" mode="aspectFill" /><view><text>{{ host.intro || '' }}</text><view @click="showStory"><text>小院故事</text><k-icon name="chevron-right" :size="12" color="muted" /></view></view></view><view class="host-stats"><view class="host-stat"><text class="host-stat__num">{{ d.completedOrders || 0 }} 单</text><text class="host-stat__label">累计接待</text></view><text class="host-stat__rate">{{ goodRateText }}</text></view></view>
      <view class="section-head"><text>房型预览</text><view @click="toBooking()"><text>查看全部房型</text><k-icon name="chevron-right" :size="12" color="muted" /></view></view><view v-if="d.stayName && !rooms.length" class="list-empty r3-empty"><view class="r3-empty-ic"><k-icon name="bed-double" :size="28" color="red" /></view><text>暂无可订房型</text></view><view class="room-list"><view v-for="room in rooms" :key="room.roomTypeId" class="room card" @click="toBooking(room)"><image :src="absUrl(room.image) || '/static/media/cover-empty.png'" mode="aspectFill" /><text v-if="room.promoPrice" class="room__promo">早鸟 ¥{{ room.promoPrice }}/晚</text><view><text>{{ room.name }}</text><text :class="{ 'is-empty': !room.desc }">{{ room.desc }}</text><view><text>¥{{ room.price }}</text><text>{{ room.priceLabel }}</text></view></view></view></view>
    </view>

    <view v-else-if="s === 3" class="vlogs-body k-pad-bottom">
      <view class="section-head"><text>近期Vlog</text><view @click="moreVlogs"><text>更多</text><k-icon name="chevron-right" :size="12" color="muted" /></view></view><view v-if="stayLoaded && !vlogs.length" class="r3-empty r3-empty--page"><view class="r3-empty-ic"><k-icon name="clapperboard" :size="28" color="red" /></view><text v-if="stayLoaded && !vlogs.length" class="list-empty">暂无Vlog</text><text class="r3-empty__sub">门店发布小院 Vlog 后会显示在这里</text></view><view class="vlog-list"><view v-for="(item,i) in vlogs" :key="item.vlogId" class="vlog" @click="openVlog(item)"><image :src="absUrl(item.image) || '/static/media/cover-empty.png'" mode="aspectFill" /><view><text class="vlog__title">{{ item.title }}</text><k-chip :tone="item.tone"><text>{{ item.tag }}</text></k-chip><view class="vlog__meta"><text>发布于 {{ item.time }}</text><view><k-icon name="heart" :size="14" color="ink" /><text>{{ item.likes }}</text><k-icon name="message-circle" :size="14" color="ink" /><text>{{ item.comments }}</text></view></view></view></view></view>
      <view class="section-head review-head"><text>住客评价 · <text>{{ d.reviewCount || 0 }}</text></text><view @click="openReviews"><text>查看全部</text><k-icon name="chevron-right" :size="12" color="muted" /></view></view><view class="guest-card"><view v-if="rv" class="guest-review"><image :src="absUrl(rv.avatar) || '/static/media/profile-avatar.jpg'" mode="aspectFill" /><view><text>{{ rv.nickname || '住客' }}</text><text>{{ rvMeta }}</text></view><view class="guest-review__star"><k-icon name="star" :size="12" color="ochre" fill /></view><text>{{ rv.rating }}</text></view><view v-if="rvParts.length" class="guest-copy guest-copy--parts"><view v-for="(part, pi) in rvParts" :key="pi" class="guest-para"><text v-if="part.label" class="guest-label">{{ part.label }}</text><text>{{ part.text }}</text></view></view><text v-else class="guest-copy">{{ rv ? rv.content : (stayLoaded ? '暂无住客评价' : '') }}</text></view>
    </view>

    <view v-else class="vlog-detail">
      <image class="vlog-video" :class="{ 'vlog-video--empty': !cur.cover }" :src="absUrl(cur.cover) || '/static/media/cover-empty.png'" mode="aspectFill" @click="playVlog" /><view v-if="!cur.cover" class="vlog-video-ph"><k-icon name="video" :size="40" color="light" /></view>
      <view class="vlog-copy"><text class="vlog-detail__title" @click="likeVlog">{{ cur.title || '' }}</text><view class="author" :class="{ 'author--noname': !cur.authorName }"><image :src="absUrl(cur.authorAvatar) || '/static/media/profile-avatar.jpg'" mode="aspectFill" /><view><view><text :class="{ 'is-empty': !cur.authorName }">{{ cur.authorName || '' }}</text><k-chip v-if="cur.roleLabel" tone="green"><text>{{ cur.roleLabel }}</text></k-chip></view><text v-if="cur.timeText">发布于 {{ cur.timeText }}</text><text class="vlog-source">{{ cur.platformLabel ? '来源：' + cur.platformLabel + ' · ' : '' }}门店已审核</text></view><view class="author-follow" :class="{ on: following }"><k-button size="sm" type="outline" @click="followHost">{{ following ? '已关注' : '关注' }}</k-button></view></view><text v-if="cur.description" class="vlog-desc" @click="commentVlog">{{ cur.description }}</text><view class="vlog-comment" @click="commentVlog"><k-icon name="message-circle" :size="18" color="ink" /><text>评论 {{ cur.comments || 0 }}</text><text class="vlog-comment__go">写评论 / 看评论</text><k-icon name="chevron-right" :size="18" color="muted" /></view><view class="vlog-review-link" hover-class="k-press" @click="openReviews"><k-icon name="messages-square" :size="18" color="ink" /><text>住客评价 · {{ d.reviewCount || 0 }}</text><k-icon name="chevron-down" :size="12" color="light" /><view><text>查看全部</text><k-icon name="chevron-right" :size="12" color="muted" /></view></view></view><view class="swipe-next" :class="{ 'swipe-next--end': vlogIdx >= vlogRows.length - 1 }" @click="nextVlog"><k-icon name="chevron-down" :size="18" color="muted" /><text>{{ nextText }}</text></view>
    </view>

    <!-- 房源已下架 / 链接失效时不再显示「立即预订」，免得点了才提示 -->
    <!-- 底部浮条（2026-10-17）：「已选：房型 | 日期 | N晚」+ 暖棕渐变「立即预订」；选了房型就带 roomTypeId 进预订页、直接选中它 -->
    <!-- 改日期（2026-10-17）：和订房入口同一个区间日历，点入住、点离店；确定后按新日期重取房型的起价和余量 -->
    <stay-range-picker v-if="dateOpen" :start="state.checkIn" :end="state.checkOut" :today="todayCn()" :min-date="todayCn()" :max-start="shiftDate(todayCn(), 180)" @cancel="dateOpen = false" @confirm="confirmDates" />
    <stay-video-player :src="playing.url" :poster="playing.cover" :title="playing.title" @close="closeVideo" />
    <!-- 2026-10-18 效果图：底部一条暖棕栏 —— 选了房型「已选：单人间 | 10.17-10.18 | 1晚」+ 价格，没选时「¥6/晚起 · 选择房型与日期」；右边白底「立即预订」 -->
    <view v-if="s < 4 && d.stayName && !loadError" class="stay-booking-dock"><view v-if="d.onlinePaymentAvailable === false" class="collection-note">本店暂未开通在线收款，可查看房价和房态。</view><view class="pickbar"><view class="picked" :class="{ 'picked--pending': !roomsReady }"><template v-if="!roomsReady"><text class="picked__from">{{ roomsLoading ? '正在查询房型' : '房型信息待确认' }}</text><text class="picked__hint">{{ roomsError ? '请重新加载价格与余量' : '请稍候' }}</text></template><template v-else-if="pickedRoom"><view class="picked__text" :aria-label="pickedText"><text class="picked__seg">已选：</text><text v-for="(p, i) in pickedSegs" :key="i" class="picked__seg">{{ p + (i < pickedSegs.length - 1 ? ' | ' : '') }}</text></view><text class="picked__price">{{ pickedPrice }}</text><text class="picked__hint">{{ pickedRoom.selectedPriceLabel }}</text></template><template v-else><text class="picked__from">{{ pickedPrice || '选好房型再预订' }}</text><text class="picked__hint">{{ priceFrom ? '7晚参考价起 · 选择房型与日期' : '选择房型与日期' }}</text></template></view><view class="book" :class="{ 'book--disabled': !canBook }" role="button" :aria-disabled="!canBook" hover-class="k-press-s" @click="bookNow"><text class="book__main">{{ roomsLoading ? '查询中' : (canBook ? (d.onlinePaymentAvailable === false ? '查看房态' : '立即预订') : '暂不可订') }}</text></view></view></view>
  </view>
</k-feature-gate>
</template>

<script setup>
import { experience } from '@/common/experience.js'
import { rememberDestination } from '@/common/camp-history.js'
import { periodDisplay, lowestPeriods } from './period-price.js'
import { stayBookingEnabled, refreshFeatures } from '@/common/features.js'
import { watch as watchStayGate } from 'vue'
import { publicShare, shareWithCover, timelineShare, showPublicShareMenu } from '@/common/public-share.js'
// ---------------------------------------------------------------------------
// 房源详情接入情况（业务键 stayId，可带 promoId；从 Vlog 进来带 vlogId 用于转化统计）：
//   s=1 概览：apiStayDetail；收藏真实写库；分享走右上角转发；位置用 uni.openLocation（门店录入的坐标）
//   s=2 设施、主理人（累计接待单数是真实完成订单数；好评率评价不足时如实写"暂无足够评价"）、房型预览
//   s=3 Vlog（门店审核通过的视频引用）与住客评价（评价模块，无评价时写"暂无住客评价"）
//   s=4 Vlog 详情：视频号同主体时直接打开，其余复制链接到对应 App（小程序内不打开外链）；描述下面的「评论」行可写 / 看评论
//       （之前入口只挂在描述文字上，没写简介的 Vlog 描述是空的、0 高度，住客根本找不到评论入口）
//   底部：原型的"预约看房 / 在线沟通 · 可接送"三件事都不存在，按钮如实改为"立即预订 / 选择房型与日期"
// ---------------------------------------------------------------------------
import { absUrl } from '@/common/upload.js'
import { coordinates } from '@/common/stay-location.js'
import { stayMapUrl } from './stays-navigation.js'
import { openNativePlace } from '@/common/place-navigation.js'
import { ref, computed, watch } from 'vue'
import { onShow, onHide, onPageScroll, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import { useScreen, back, go, toast } from '@/common/screen.js'
import {
  apiStayDetail, apiStayFavorite, apiStayVlogs, apiStayVlogOpen, apiStayVlogLike, apiStayVlogComment, apiStayVlogTrack, apiFollowStore,
  apiStayVlogComments, apiStayVlogReport, apiStayRoomTypes, apiStoreActivities
} from '@/common/api.js'
import { storeActivities, stayPastActivitiesUrl } from './stays-activities.js'
import { errText, alert, prompt, copy, yuan, sheet, pickPaged, confirm, todayCn, shiftDate } from '@/common/ui.js'
import { stayState, normalizeDates, saveStayState, nightsBetween, dotText } from './stays-state.js'
import { srcLabel, fewLeft, roomSpec, roomRate, dateRange, pickedLine, pickedParts, bookingQuery, hostFacts, travelRows, scoreText } from './stays-ui.js'
import { stayReviewsUrl, contentParts } from './stays-reviews.js'
import { INTRO_TITLE, INTRO_CAPTION, DIARY_TITLE, DIARY_SUB, ROOM_VIDEO_BADGE, introCard, diaryEntry, entryCount, roomVideo, stayDiaryUrl } from './stays-media.js'
import StayVideoPlayer from './stay-video-player.vue'
import StayRangePicker from './components/stay-range-picker.vue'
import { stayAiSummary } from './stays-ai-summary.js'
import R from '@/common/routes.js'
import { STAY_ART } from './stays-art.js'

let stayId = 0
let promoId = 0
let fromVlog = 0
let landing = 1
const s = useScreen(4, {
  onLoad: (q) => {
    stayId = Number(q?.stayId) || 0
    promoId = Number(q?.promoId) || 0
    fromVlog = Number(q?.vlogId) || 0
    landing = s.value
  }
})
// 之前房型预览 / 设施 / 主理人那一屏（s=2）没有任何入口，Vlog 与评价只能点评分进；任何一屏点返回都直接退出房源页。
// 现在概览底部放两个入口；页内切过去的屏返回上一屏（Vlog 详情 → Vlog 列表 → 概览），直接打开的那一屏（通知 ?s=3）回来源页
const onBack = () => {
  if (s.value === landing) return back()
  s.value = s.value === 4 ? 3 : 1
}
// 全站状态栏是黑字（pages.json），Vlog 详情屏（s=4）底色近黑，手机的时间 / 信号 / 电量和右上角胶囊几乎看不见。
// 只在这一屏改成白字：切回其它屏、页面被盖住或切后台时改回黑字，回到本页还停在这一屏时再改白。
// frontColor 只认 #ffffff / #000000；自定义导航栏下 backgroundColor 看不到，但必须传
// #ifdef MP-WEIXIN
const barColor = (dark) => uni.setNavigationBarColor({
  frontColor: dark ? '#ffffff' : '#000000', backgroundColor: dark ? '#151311' : '#FCF9F3', animation: { duration: 0 }, fail: () => {}
})
watch(() => s.value === 4, barColor)
onShow(() => { if (s.value === 4) barColor(true) })
onHide(() => { if (s.value === 4) barColor(false) })
// #endif
const d = ref({})
const loadError = ref('')
// 详情读到过才算「加载完」：在这之前「暂无家人评价」「主理人介绍待补充」这类结论性文字都不显示（只是还没读到，不是真的没有）
const stayLoaded = ref(false)
const detailLoading = ref(false)
const canRetryDetail = ref(false)
let detailSequence = 0
onShow(() => load())
// Vlog 带来的详情页浏览只记一次：onShow 每次回到本页（看地图、从预订页返回）都会再进 load，之前每回来一次就多记一次转化
let vlogTracked = false
async function load() {
  if(!(await refreshFeatures()).stayBookingEnabled) return
  // 日期先补好：详情读到之前房型区也要显示，之前这时写的是「· 0晚」
  normalizeDates()
  if (!stayId) {
    loadError.value = '房源不存在或已下架'
    canRetryDetail.value = false
    return
  }
  const sequence = ++detailSequence
  detailLoading.value = true
  try {
    const data = (await apiStayDetail(stayId)).data
    if (sequence !== detailSequence) return
    if (!data) throw new Error('房源不存在或已下架')
    d.value = data
    rememberDestination(experience.account?.id, data.city)
    stayLoaded.value = true
    loadError.value = ''
    canRetryDetail.value = false
    if (fromVlog && !vlogTracked) { vlogTracked = true; apiStayVlogTrack(fromVlog, 'detail').catch(() => {}) }
    loadVlogs()
    loadActivities()
    // 每次回到本页都重取房型：在预订页改了日期 / 人数回来，起价、余量要跟着变
    loadRooms()
  } catch (e) {
    if (sequence !== detailSequence) return
    loadError.value = errText(e, '房源不存在或已下架')
    // 服务端明确说房源没了，重试也没用；断网、超时、服务端故障才给「重新加载」
    canRetryDetail.value = !/不存在|已下架|已删除/.test(loadError.value)
    toast(loadError.value)
  } finally {
    if (sequence === detailSequence) detailLoading.value = false
  }
}
const retryDetail = () => { if (!detailLoading.value) load() }

// ---------------- 概览 ----------------
// 首屏的起价与房型数（之前起价只在底栏）；特色并入下面的 highlights，一起在标题下展示
const periodSummary = computed(() => periodDisplay(roomsLoaded.value ? { periodPrices: lowestPeriods(roomRows.value) } : d.value, true))
const priceFrom = computed(() => periodSummary.value.price || (Number(d.value.displayPriceFen) > 0 ? yuan(d.value.displayPriceFen) : ''))
const roomCount = computed(() => (d.value.roomTypes || []).length)
// 一位小数（5 → 「5.0」，和评价页、房型卡上的分数写法一致）
const ratingMain = computed(() => roomRate(d.value)?.score || '')
const reviewAi = computed(() => stayAiSummary(d.value.ai))
// 效果图 7 的说法：没有评价时写「暂无家人评价」（住过的人叫「家人」）
const ratingSub = computed(() => (!stayLoaded.value ? '' : ratingMain.value ? `分 · ${d.value.reviewCount || 0}条评价` : '暂无家人评价'))
const reviewEntryText = computed(() => (!stayLoaded.value ? (loadError.value ? '评价暂未加载' : '正在加载评价…') : ratingMain.value ? `${d.value.reviewCount}条真实评价` : '暂无家人评价'))

// ---------------- 沉浸式头图（2026-10-17） ----------------
// 顶栏透明叠在头图上：头图往上提一个顶栏高度（状态栏 + 44px 导航，和 k-topbar 同一算法），滑过头图后顶栏铺回底色、出标题
let barHeight = 88
// #ifndef H5
try { barHeight = (uni.getSystemInfoSync().statusBarHeight || 20) + 44 } catch (e) { barHeight = 64 }
// #endif
// 2026-11-03 主人：「房源详情往上移一点」—— 顶上的「房源详情」胶囊和右上角微信胶囊（··· ◎）对齐在同一行、一样高（32px）。
// 小程序按微信胶囊的实际位置算（胶囊 top 是从屏幕顶量的，减掉状态栏就是在 44px 导航栏里的位置）；网页版顶栏里画的假胶囊在导航栏里垂直居中
const PILL_H = 32
let pillTop = (44 - PILL_H) / 2
// #ifdef MP-WEIXIN
try {
  const menu = uni.getMenuButtonBoundingClientRect()
  const statusBar = uni.getSystemInfoSync().statusBarHeight || 20
  if (menu && menu.height > 0 && menu.top >= statusBar) pillTop = Math.round(menu.top - statusBar + (menu.height - PILL_H) / 2)
} catch (e) { /* 拿不到胶囊位置就按导航栏居中 */ }
// #endif
const pillStyle = 'top:' + pillTop + 'px'
const barSolid = ref(false)
onPageScroll((e) => {
  // 紧凑头图 224px、信息卡上叠 64px，在信息卡碰到顶栏前切换底色。
  const solid = (e && e.scrollTop) > Math.max(0, 224 - 64 - barHeight)
  if (solid !== barSolid.value) barSolid.value = solid
})
// 头图：封面 + 房源图集（详情接口一直有 images，之前没画出来），去重；两张以上左右滑、右下角「1/5」，点开看大图
const gallery = computed(() => [...new Set([d.value.cover].concat(d.value.images || []).filter(Boolean))])
const heroIdx = ref(0)
const onHero = (e) => { heroIdx.value = (e && e.detail && e.detail.current) || 0 }
const previewHero = (i) => {
  const urls = gallery.value.map(absUrl)
  if (urls.length) uni.previewImage({ urls, current: urls[i] || urls[0] })
}
// 信息卡标签：来源（袋鼠直营 / 袋鼠合作）、安心住、亮点（特色、长住优惠、厨房、设施）
const infoChips = computed(() => {
  const out = []
  if (d.value.stayName) out.push({ text: srcLabel(d.value.operateMode), tone: 'src' })
  if (d.value.safeCert) out.push({ text: '安心住', tone: 'safe' })
  for (const t of highlights.value) out.push({ text: t, tone: 'plain' })
  return out
})
const toRooms = () => uni.pageScrollTo({ selector: '#stay-rooms', offsetTop: -barHeight, duration: 200, fail: () => {} })
const hasHost = computed(() => { const h = host.value; return !!(h.name || h.avatar || h.intro || h.story || h.age || h.hometown || h.skills) })
// 主理人卡（2026-10-17 R2）：称呼是卡片上的大字，下面一行放 年龄 / 籍贯 / 擅长（只放填了的）；主理人评分 = 服务分平均（服务端算，不足 3 条是 null）
const hostMeta = computed(() => hostFacts(host.value).filter(f => f.k !== '称呼'))
const hostScore = computed(() => scoreText(host.value.score))
// 出行参考四行（只放填了的）：优点绿、缺点橙，机场 / 高铁普通色
const TRIP_TONE = { 优点: 'good', 缺点: 'warn' }
const travel = computed(() => travelRows(d.value.travel).map(r => ({ ...r, tone: TRIP_TONE[r.k] || 'plain' })))
async function toggleFavorite() {
  if (!stayId) return
  const next = !d.value.favorite
  try {
    const res = await apiStayFavorite(stayId, next)
    d.value = { ...d.value, favorite: next }
    toast(res.msg || (next ? '已收藏' : '已取消收藏'))
  } catch (e) {
    toast(errText(e, '请先登录'))
  }
}
const shareTip = () => {
  // #ifdef MP
  showPublicShareMenu()
  // #endif
  toast('点右上角「···」转发给朋友')
}
// 地图位置：房源自己没选点时，服务端用门店登记的坐标兜底（mapFrom = store，和「到店路线」同一规则），这里照常读 latitude / longitude
const mapPoint = computed(() => coordinates(d.value))
const locationText = computed(() => String(d.value.address || d.value.areaDesc || '').trim())
// 复制给地图搜索用的地址：地址里没写城市时前面补上城市（「东湖山庄98号」单独搜不到，「平潭 东湖山庄98号」才找得到）
const searchAddress = computed(() => {
  const city = String(d.value.city || '').trim()
  return city && !locationText.value.includes(city.replace(/市$/, '')) ? city + ' ' + locationText.value : locationText.value
})
const copyAddress = async () => {
  if (!locationText.value) return toast('地址暂未填写')
  if (!(await copy(searchAddress.value, '地址已复制，可以到高德或腾讯地图里搜索'))) toast('复制失败，请长按地址复制')
}
const openMap = () => {
  // H5 使用地图官方链接，移动端可调起地图 App；无需地图 SDK 密钥。
  // #ifdef H5
  const url = stayMapUrl({ ...d.value, address: searchAddress.value })
  if (!url) return toast('房源位置待补充')
  window.location.assign(url)
  return
  // #endif
  // 微信使用门店登记的真实坐标，不用城市中心点冒充门店位置。
  // #ifndef H5
  openNativePlace(d.value, uni, toast)
  // #endif
}

// ---------------- 设施、主理人、房型 ----------------
// 设施代码 → [图标, 名称]。2026-10-17 R2：字典补了 study 学习室、gym 健身房；图标用 common/icons.js 里已有的（book-open / activity），不往主包加图标
// 2026-11-03（V70）：字典补了 floorheat 地暖，图标用已有的 thermometer
const FAC = { bath: ['bath', '独立卫浴'], ac: ['wind', '空调'], hotwater: ['droplet', '热水'], wifi: ['wifi', 'Wi-Fi'], washer: ['shirt', '洗衣'], parking: ['car', '停车'], balcony: ['square-plus', '阳台'], study: ['book-open', '学习室'], gym: ['activity', '健身房'], floorheat: ['thermometer', '地暖'] }
const facilities = computed(() => (d.value.facilities || []).filter(c => FAC[c]).slice(0, 5).map(c => ({ icon: FAC[c][0], art: 'amenity-' + c, label: FAC[c][1] })))
// 首屏亮点，只用详情里已有的数据：门店写的特色（最多 3 个）→ 长住优惠 → 带厨房 / 可做饭 → 设施；去重后最多 5 个
const zhe = (rate) => (rate % 10 ? (rate / 10).toFixed(1) : String(rate / 10))
const highlights = computed(() => {
  const x = d.value
  const out = (x.features || []).slice(0, 4)
  const nights = Number(x.longStayNights) || 0
  const rate = Number(x.longStayRate) || 100
  if (nights > 0 && rate > 0 && rate < 100) out.push(`住满${nights}晚${zhe(rate)}折`)
  if (String(x.kitchen) === '1') out.push('带厨房')
  else if (String(x.cookable) === '1') out.push('可做饭')
  for (const c of x.facilities || []) if (FAC[c]) out.push(FAC[c][1])
  return [...new Set(out)].slice(0, 5)
})
const host = computed(() => d.value.host || {})
const goodRateText = computed(() => (!stayLoaded.value ? '' : d.value.goodRate == null ? '暂无足够评价' : d.value.goodRate + '%　好评率'))
// 早鸟：之前底栏「¥180/晚起」旁边挂一个「早鸟价」，¥180 其实是日常价，真正的早鸟价（如 ¥150）页面上哪儿都没有。
// 现在标签写出早鸟价；从早鸟特价点进来的（带 promoId，预订页会按早鸟价报价）再在对应房型卡片上标出来。
// 没带 promoId 时不标房型卡片：那样进预订页是按日常价报价的，标了反而对不上
const promo = computed(() => {
  const list = d.value.promos || (d.value.promo ? [d.value.promo] : [])
  return list.find(p => Number(p.promoId) === promoId) || list[0] || null
})
const promoPrice = computed(() => (promo.value && Number(promo.value.priceFen) > 0 ? yuan(promo.value.priceFen) : ''))
const promoRoomId = computed(() => (promoId && promo.value && Number(promo.value.promoId) === promoId ? Number(promo.value.roomTypeId) : 0))
const rooms = computed(() => (roomsLoaded.value ? roomRows.value : (d.value.roomTypes || [])).slice(0, 2).map(r => ({ roomTypeId: r.roomTypeId, name: r.typeName, desc: r.summary, price: r.displayPriceFen == null ? '--' : yuan(r.displayPriceFen), priceLabel: r.displayPriceLabel || '7晚参考价', ...periodDisplay(r), image: r.cover,
  promoPrice: promoRoomId.value && Number(r.roomTypeId) === promoRoomId.value ? promoPrice.value : '' })))
const showStory = () => alert('小院故事', host.value.story || '主理人还没有写小院故事')
const toBooking = (room) => {
  if (!stayId || loadError.value || !d.value.stayName) return toast('房源不存在或已下架')
  if (!roomsReady.value) return toast(roomsLoading.value ? '正在查询房型，请稍候' : '请先重新加载房型价格与余量')
  if (!canBook.value) return toast('所选日期暂无可订房型，请修改日期')
  if (room && !roomList.value.some(r => r.roomTypeId === Number(room.roomTypeId) && r.bookable)) return toast('该房型当前不可订，请重新选择')
  go(R.stayBooking + '?' + bookingQuery({ stayId, roomTypeId: room && room.roomTypeId, promoId, vlogId: fromVlog }))
}

// ---------------- 可选空余房型 + 底部浮条（2026-10-17，效果图 7） ----------------
// 日期 / 人数和列表页、预订页共用一份（stays-state.js），这里按它取每个房型的起价、余量、能不能订
const state = stayState
const nights = computed(() => nightsBetween(state.checkIn, state.checkOut))
const datesText = computed(() => dateRange(dotText(state.checkIn), dotText(state.checkOut)))
const roomRows = ref([])
const roomsLoaded = ref(false)
const roomsLoading = ref(false)
const roomsError = ref('')
const selRoomId = ref(0)
let roomsSequence = 0
async function loadRooms() {
  normalizeDates()
  const sequence = ++roomsSequence
  const params = { checkIn: state.checkIn, checkOut: state.checkOut, guests: state.guests, promoId: promoId || undefined }
  const current = () => sequence === roomsSequence && params.checkIn === state.checkIn && params.checkOut === state.checkOut && params.guests === state.guests
  roomsLoading.value = true
  roomsLoaded.value = false
  roomsError.value = ''
  roomRows.value = []
  try {
    const rows = (await apiStayRoomTypes(stayId, params)).data || []
    if (!current()) return
    roomRows.value = rows
    roomsLoaded.value = true
    const cur = rows.find(r => Number(r.roomTypeId) === selRoomId.value)
    if (!cur || cur.bookable === false) selRoomId.value = 0
    // 从早鸟特价进来：只选已确认当前日期有余量的房型。
    if (!selRoomId.value && promoRoomId.value) {
      const p = rows.find(r => Number(r.roomTypeId) === promoRoomId.value && r.bookable === true)
      if (p) selRoomId.value = Number(p.roomTypeId)
    }
  } catch (e) {
    if (!current()) return
    roomsError.value = '房型价格与余量加载失败，请重试'
    selRoomId.value = 0
  } finally {
    if (sequence === roomsSequence) roomsLoading.value = false
  }
}
// 2026-10-18：规格一行改成「1人｜独立卫浴｜空调｜可做饭」（roomSpec）；rate 是这个房型自己的评分（接口 rating / reviewCount，没有评价是 null）
const roomList = computed(() => roomRows.value.map(r => ({
  selectedPrice: (r.displayPayFen ?? r.displayPriceFen) == null ? '--' : yuan(r.displayPayFen ?? r.displayPriceFen), selectedPriceLabel: r.displayPriceLabel || '房费待查询',
  roomTypeId: Number(r.roomTypeId), name: r.typeName, cover: r.cover || d.value.cover, line: roomSpec(r), rate: roomRate(r), ai: stayAiSummary(r.ai), price: r.displayPriceFen == null ? '--' : yuan(r.displayPriceFen), priceLabel: r.displayPriceLabel || '7晚参考价', ...periodDisplay(r),
  bookable: r.bookable === true, reason: r.reason || '', few: fewLeft(r), video: roomVideo({ ...r, cover: r.cover || d.value.cover }),
  promoPrice: promoRoomId.value && Number(r.roomTypeId) === promoRoomId.value ? promoPrice.value : ''
})))
const pickedRoom = computed(() => roomList.value.find(r => r.roomTypeId === selRoomId.value) || null)
const roomsReady = computed(() => roomsLoaded.value && !roomsLoading.value && !roomsError.value)
const canBook = computed(() => roomsReady.value && roomList.value.some(r => r.bookable))
// 「可选空余房型」右边的日期点开区间日历；换了日期，房型的起价 / 余量 / 能不能订都要按新日期重取
const dateOpen = ref(false)
function confirmDates(r) {
  dateOpen.value = false
  if (!r || !r.start || !r.end || (r.start === state.checkIn && r.end === state.checkOut)) return
  state.checkIn = r.start
  state.checkOut = r.end
  normalizeDates()
  saveStayState()
  loadRooms()
}
function pickRoom(r) {
  if (!roomsReady.value) return toast('请先加载所选日期的价格与余量')
  if (!r.bookable) return toast((r.reason || '这个房型所选日期订不了') + '，可以换个房型或进预订页改日期')
  selRoomId.value = r.roomTypeId
  toBooking(r)
}
const pickedText = computed(() => pickedLine(pickedRoom.value && pickedRoom.value.name, datesText.value, nights.value))
const pickedSegs = computed(() => pickedParts(pickedRoom.value && pickedRoom.value.name, datesText.value, nights.value))
const pickedPrice = computed(() => (pickedRoom.value ? `¥${pickedRoom.value.selectedPrice}` : (priceFrom.value ? `¥${priceFrom.value}` : '')))
const bookNow = () => toBooking(pickedRoom.value)
const openPromo = () => go(R.staysList + '?view=promo&city=' + encodeURIComponent(d.value.city || ''))

// ---------------- Vlog 与评价 ----------------
const vlogRows = ref([])
const vlogIdx = ref(0)
const cur = computed(() => vlogRows.value[vlogIdx.value] || {})
const vlogs = computed(() => vlogRows.value.map(v => ({
  vlogId: v.vlogId, title: v.title, tag: v.authorRole === 'host' ? '主理人' : v.platformLabel, tone: v.authorRole === 'host' ? 'green' : 'ochre',
  time: v.timeText, likes: v.likes, comments: v.comments, image: v.cover
})))
async function loadVlogs() {
  try { vlogRows.value = (await apiStayVlogs(stayId)).data || [] } catch (e) { vlogRows.value = [] }
}
async function openVlog(item) {
  const i = vlogRows.value.findIndex(v => v.vlogId === item.vlogId)
  if (i < 0) return
  vlogIdx.value = i
  s.value = 4
  try {
    const v = (await apiStayVlogOpen(item.vlogId)).data
    if (v) vlogRows.value.splice(i, 1, { ...vlogRows.value[i], ...v })
  } catch (e) { /* 打开次数记不上不影响观看 */ }
}
const playVlog = () => {
  const v = cur.value
  if (!v.vlogId) return
  // #ifdef MP-WEIXIN
  if (v.platform === 'channels' && v.finderUserName && v.feedId && wx.openChannelsActivity) {
    wx.openChannelsActivity({ finderUserName: v.finderUserName, feedId: v.feedId, fail: () => copyLink(v) })
    return
  }
  // #endif
  copyLink(v)
}
const copyLink = (v) => {
  if (!v.link) return toast('该视频暂未提供链接')
  copy(v.link, `链接已复制，可在${v.platformLabel}打开`)
}
const nextVlog = () => {
  if (vlogIdx.value < vlogRows.value.length - 1) openVlog(vlogRows.value[vlogIdx.value + 1])
}
const nextText = computed(() => (vlogIdx.value < vlogRows.value.length - 1 ? '下滑看下一条' : '已是最后一条'))
// 点描述：写评论 / 看评论（2026-09-26 补：评论列表与举报后端早有接口，此前只能写不能看）。用系统菜单，不改页面结构
async function commentVlog() {
  const v = cur.value
  if (!v.vlogId) return
  const i = await sheet(['写评论', '查看评论'])
  if (i < 0) return
  if (i === 1) return viewComments(v)
  const text = await prompt('写评论', { placeholder: '说说你对这段视频的感受（200 字以内）' })
  if (!text) return
  if (text.length > 200) return toast('评论最多 200 字')
  try {
    const res = await apiStayVlogComment(v.vlogId, text)
    toast(res.msg || '评论已发布')
    loadVlogs()
  } catch (e) {
    toast(errText(e, '请先登录'))
  }
}
async function viewComments(v) {
  try {
    const list = (await apiStayVlogComments(v.vlogId)).data || []
    if (!list.length) return toast('还没有评论，来写第一条吧')
    const k = await pickPaged(list.map(c => `${c.nickname || '住客'}：${c.content}` + (c.reply ? `（门店回复：${c.reply}）` : '')), '住客评论')
    if (k < 0) return
    const c = list[k]
    const j = await sheet(['举报这条评论'])
    if (j !== 0) return
    if (!(await confirm('举报评论', '确认这条评论有违规内容？门店与平台会复核处理。'))) return
    const res = await apiStayVlogReport(c.commentId)
    toast(res.msg || '已提交举报')
  } catch (e) {
    toast(errText(e, '请先登录'))
  }
}
async function likeVlog() {
  const v = cur.value
  if (!v.vlogId) return
  try {
    const r = (await apiStayVlogLike(v.vlogId)).data || {}
    vlogRows.value.splice(vlogIdx.value, 1, { ...v, likes: r.likes, liked: true })
    toast('已点赞')
  } catch (e) {
    toast(errText(e, '请先登录'))
  }
}
// 关注主理人 = 关注这家门店：门店有新岗位上架时按你的通知设置提醒你。
// 只作用在自己账号上，不会通知门店，也不会把你的关注展示给别人。
const following = computed(() => !!host.value.following)
const followHost = async () => {
  const storeId = host.value.storeId
  if (!storeId) {
    toast('这间房源还没有关联门店')
    return
  }
  try {
    const res = await apiFollowStore(storeId, !following.value)
    toast((res.data && res.data.message) || '已更新')
    await load()
  } catch (e) {
    toast(errText(e, '请先登录'))
  }
}
async function moreVlogs() {
  if (!vlogs.value.length) return toast('暂无Vlog')
  const i = await pickPaged(vlogs.value.map(v => v.title || '未命名Vlog'), '选择 Vlog')
  if (i >= 0) openVlog(vlogs.value[i])
}
// 2026-10-17 R3：「住过的家人评价」进新的小院评价页（R2 做的 pages/stays/reviews：这家小院自己的汇总、分项、大家提到、有图·视频）；
// 之前进的是门店的同行队伍页（s=4），汇总按整家门店算
const openReviews = () => {
  if (!stayId) return toast('房源不存在或已下架')
  go(stayReviewsUrl(stayId))
}
const openRoomReviews = (room) => {
  if (!stayId || !room?.roomTypeId) return
  go(stayReviewsUrl(stayId, room.roomTypeId, room.name))
}

// ---------------- 3分钟看小院、房型短视频、近期生活碎片（2026-10-17 R3） ----------------
const introVideo = computed(() => introCard(d.value.introVideo, d.value.cover))
const diary = computed(() => diaryEntry(d.value.diary))
const entryN = computed(() => entryCount(!!diary.value, vlogs.value.length))
const openDiary = () => go(stayDiaryUrl(stayId))
// 正在播的视频 {url, cover, title}；空对象 = 没在播（播放层不出现）
const playing = ref({})
const playVideo = (v, title) => {
  if (!v || !v.url) return toast('视频暂时看不了')
  playing.value = { url: v.url, cover: v.cover || '', title: title || '' }
}
const closeVideo = () => { playing.value = {} }
onHide(closeVideo)
// ---------------- 小院活动（2026-11-03 主人：二销产品的价格、限时活动、往期活动，不需要关注门店） ----------------
// 按房源所属门店取这家门店主办的活动；门店没有活动、接口出错都是空的，整块不出现（不影响订房）
const actsRaw = ref(null)
// 倒计时「剩N天 / 小时 / 分钟」按这个时间算：每次回到本页重取活动时更新（倒计时只精确到天 / 小时，不用每分钟刷）
const actsNow = ref(Date.now())
const acts = computed(() => storeActivities(actsRaw.value, actsNow.value))
let actsSequence = 0
async function loadActivities() {
  const storeId = Number(host.value.storeId) || 0
  const sequence = ++actsSequence
  if (!storeId) { actsRaw.value = null; return }
  try {
    const data = (await apiStoreActivities(storeId)).data
    if (sequence !== actsSequence) return
    actsRaw.value = data || null
    actsNow.value = Date.now()
  } catch (e) {
    if (sequence === actsSequence) actsRaw.value = null
  }
}
const openActivity = (a) => { if (a && a.activityId) go(R.activity + '?id=' + a.activityId + '&channel=home') }
const openPastActivities = () => {
  const url = stayPastActivitiesUrl(host.value.storeId, d.value.stayName)
  if (url) go(url)
}
const rv = computed(() => d.value.reviewLatest || null)
const rvParts = computed(() => (rv.value ? contentParts(rv.value.content) : [])) // 纯展示：把正文里的【卫生】拆成小标签 + 正文（和评价页同一种），字不改
const rvMeta = computed(() => (rv.value && rv.value.createTime ? `${+rv.value.createTime.slice(5, 7)}月${+rv.value.createTime.slice(8, 10)}日` : ''))

const pageShareMessage = () => ({ title: d.value.stayName || '袋鼠全球青年', path: '/pages/stays/detail?stayId=' + stayId })


onShareAppMessage((event) => shareWithCover(pageShareMessage(event)))
onShareTimeline(() => timelineShare(pageShareMessage()))
onShow(showPublicShareMenu)
watchStayGate(stayBookingEnabled, enabled => { if(enabled) load() })
</script>

<style scoped lang="scss">

.week-price-note{display:block;font-size:12px;line-height:1.6;color:var(--k-muted);margin:8px 0}.rt__price,.info-price__row{flex-wrap:wrap}
@import '../../styles/look.scss';
.stay-detail { font-family: var(--k-sans); }.vlog-page { background: var(--k-bg); }.hero { display: block; width: 100%; height: 320px; }.overview-body { padding: 0 16px 14px; }.title-row { display: flex; }.title-row>view:first-child { flex: 1; }.title-row>view:first-child>view:first-child { display: flex; align-items: center; gap: 7px; }.title-row>view:first-child>view:first-child>text { font-size: 22px; font-weight: 700; line-height: 1.35; letter-spacing: .3px; }.rating { display: flex; align-items: baseline; }.rating text:first-child { color: var(--k-red); font: 700 22px var(--k-display-font); }.rating text:nth-child(2) { margin-left: 4px; font-size: 14px; color: var(--k-ink2); }.title-actions { flex: 0 0 auto; display: flex; gap: 14px; padding-top: 2px; }.title-actions>view { display: flex; flex-direction: column; align-items: center; font-size: 11px; }.slogan { height: 91px; padding: 13px; border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-paper2); display: flex; align-items: center; }.slogan>view { flex: 1; display: flex; flex-direction: column; }.slogan>view text:first-child { font-size: 19px; font-weight: 700; }.slogan>view text:last-child { margin-top: 7px; color: var(--k-muted); font-size: 12px; }.slogan image { width: 112px; height: 75px; }
.rooms-body,.vlogs-body { padding: 7px 14px calc(86px + var(--k-safe-bottom)); }.facilities { height: 79px; display: flex; justify-content: space-between; align-items: center; }.facilities>view { width: 19%; display: flex; flex-direction: column; align-items: center; gap: 7px; font-size: 12px; }.card { border: 1px solid var(--k-line); border-radius: 12px; background: rgba(253,251,247,.8); }.host { padding: 13px; }.host-title { display: flex; align-items: center; gap: 8px; font-size: 18px; font-weight: 700; }.host-main { display: flex; align-items: center; margin-top: 12px; }.host-main>image { width: 62px; height: 62px; border-radius: 50%; }.host-main>view { flex: 1; margin-left: 13px; }.host-main>view>text { display: block; color: var(--k-muted); font-size: 13px; }.host-main>view>view { margin-top: 12px; display: flex; align-items: center; font-weight: 700; }.host-stats { height: 35px; margin-top: 9px; border-top: 1px solid var(--k-line); display: flex; align-items: flex-end; justify-content: space-around; font-weight: 700; }.section-head { height: 54px; display: flex; align-items: center; justify-content: space-between; }.section-head>text { font-size: 20px; font-weight: 700; }.section-head>view { display: flex; align-items: center; color: var(--k-muted); }.room-list { display: grid; gap: 12px; }.room { height: 133px; overflow: hidden; display: flex; }.room>image { width: 145px; height: 133px; }.room>view { flex: 1; padding: 17px 13px; }.room>view>text:first-child { display: block; font-size: 18px; font-weight: 700; }.room>view>text:nth-child(2) { display: block; margin-top: 12px; color: var(--k-muted); font-size: 12px; }.room>view>view { margin-top: 24px; text-align: right; }.room>view>view text:first-child { color: var(--k-red); font: 700 23px var(--k-display-font); }.room>view>view text:last-child { color: var(--k-muted); font-size: 11px; }
.vlogs-body { padding-top: 0; }.vlog-list { display: grid; gap: 12px; }.vlog { height: 126px; display: flex; }.vlog>image { width: 150px; height: 126px; border-radius: 9px; }.vlog>view { flex: 1; padding: 8px 0 5px 13px; display: flex; flex-direction: column; align-items: flex-start; }.vlog__title { white-space: pre-line; font-size: 16px; font-weight: 700; }.vlog__meta { width: 100%; margin-top: auto; display: flex; align-items: center; justify-content: space-between; color: var(--k-muted); font-size: 11px; }.vlog__meta>view { display: flex; align-items: center; gap: 5px; }.review-head { margin-top: 6px; border-top: 1px solid var(--k-line); }.review-head>text>text { font-size: 14px; font-weight: 400; }.guest-review { display: flex; align-items: center; }.guest-review>image { width: 45px; height: 45px; border-radius: 50%; }.guest-review>view { margin-left: 9px; display: flex; flex-direction: column; }.guest-review>view text:first-child { font-size: 16px; font-weight: 700; }.guest-review>view text:last-child { color: var(--k-muted); font-size: 11px; }.guest-review>text { margin-left: auto; color: var(--k-red); font: 24px var(--k-sans); }.guest-copy { display: block; margin-top: 10px; font-size: 13px; line-height: 1.7; }
.vlog-detail { padding-bottom: calc(18px + var(--k-safe-bottom)); }.vlog-video { width: 100%; height: 450px; }.vlog-copy { padding: 13px 16px; }.vlog-detail__title { display: block; font-size: 20px; font-weight: 700; }.author { margin-top: 13px; display: flex; align-items: center; }.author>image { width: 46px; height: 46px; border-radius: 50%; }.author>view { flex: 1; margin-left: 9px; }.author>view>view { display: flex; align-items: center; gap: 7px; font-size: 15px; font-weight: 700; }.author>view>text { color: var(--k-muted); font-size: 11px; }.vlog-desc,.vlog-source { display: block; margin-top: 12px; font-size: 13px; }.vlog-source { color: var(--k-muted); }.vlog-review-link { height: 58px; padding: 0 16px; border-top: 1px solid var(--k-line); border-bottom: 1px solid var(--k-line); display: flex; align-items: center; gap: 15px; }.vlog-review-link>text { font-size: 18px; font-weight: 700; }.vlog-review-link>view { margin-left: auto; display: flex; align-items: center; color: var(--k-muted); }.swipe-next { margin-top: 12px; display: flex; align-items: center; justify-content: center; gap: 7px; color: var(--k-muted); font-size: 12px; }
/* 底部暖棕栏（2026-10-18）：整条暖棕渐变、白字，右边白底棕字「立即预订」 */
.pickbar { flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; padding: 8px 8px 8px 16px; border-radius: 18px; background: linear-gradient(90deg, var(--k-red-deep), #A8743F); box-shadow: 0 6px 16px rgba(138, 94, 54, .25); }
.picked { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }.picked__text { display: flex; flex-wrap: wrap; font-size: 12px; font-weight: 600; color: var(--k-paper); line-height: 1.45; }.picked__seg { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: pre; }.picked__price { font-size: 12px; color: rgba(255,255,255,.88); font-family: var(--k-sans); font-weight: 700; }
.picked__from { font: 700 18px var(--k-display-font); color: var(--k-paper); line-height: 1.2; }.picked__hint { font-size: 12px; color: rgba(255,255,255,.85); }
.book { flex: 0 0 auto; height: 42px; padding: 0 20px; border-radius: 999px; background: var(--k-paper); display: flex; align-items: center; justify-content: center; }.book__main { color: var(--k-red-deep); font-size: 16px; font-weight: 700; letter-spacing: 1px; }
.book--disabled { opacity: .55; }
.picked--pending .picked__from { font-size: 16px; line-height: 1.4; }
.picked--pending .picked__hint { font-size: 11px; line-height: 1.5; }
.rooms-state { min-height: 110px; padding: 22px 14px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; color: var(--k-muted); font-size: 13px; line-height: 1.6; text-align: center; }
.detail-retry { min-height: 0; padding: 10px 0 2px; }
.rooms-state__retry { border: 1px solid var(--k-red-line); color: var(--k-red-deep); border-radius: 18px; padding: 7px 16px; min-height: 32px; display: flex; align-items: center; }
/* 2026-10-17 改版（效果图 7）：头图下的白色信息卡往上叠 26px、大圆角 + 柔阴影；标签一行小胶囊；评分在左、起价 +「N种房型可选」在右 */
.hero-box { position: relative; background: #DDD5C8; }
.hero-fade { position: absolute; left: 0; right: 0; top: 0; height: 110px; background: linear-gradient(180deg, rgba(252,249,243,.82) 0%, rgba(252,249,243,0) 100%); pointer-events: none; }
.hero-count { position: absolute; right: 14px; bottom: 38px; height: 22px; padding: 0 9px; border-radius: 11px; background: rgba(36,27,23,.5); color: var(--k-paper); font-size: 12px; line-height: 22px; font-family: var(--k-sans); }
.info { position: relative; z-index: 1; margin: -26px 12px 0; padding: 16px 14px 14px; border-radius: 20px; background: var(--k-paper); box-shadow: var(--k-sh1); }
.info-chips { margin-top: 10px; display: flex; flex-wrap: wrap; gap: 6px; }
.ichip { height: 22px; padding: 0 9px; border-radius: 999px; display: flex; align-items: center; font-size: 12px; background: var(--k-paper2); color: var(--k-ink2); }
.ichip--src { background: var(--k-red-soft); color: var(--k-red-deep); font-weight: 600; }
.ichip--safe { background: var(--k-green-soft); color: var(--k-green); font-weight: 600; }
.info-meta { margin-top: 12px; display: flex; align-items: flex-end; justify-content: space-between; gap: 10px; }
.info-price { flex: 0 0 auto; display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
.info-price__row { display: flex; align-items: baseline; }
.info-price__num { color: var(--k-red); font: 700 24px var(--k-display-font); line-height: 1; }
.info-price__unit { color: var(--k-muted); font-size: 12px; margin-left: 2px; }
.info-price__pill { height: 22px; padding: 0 9px; border-radius: 999px; border: 1px solid var(--k-red-line); color: var(--k-red-deep); font-size: 12px; display: flex; align-items: center; }
.info-promo { margin-top: 8px; display: flex; }
.title-actions>view { color: var(--k-ink2); }
/* 主理人卡、入口卡、房型卡：白卡 + 柔阴影，标题 18px 粗体 */
.sec-card { margin-top: 14px; padding: 14px; border-radius: 18px; background: var(--k-paper); box-shadow: var(--k-sh1); }
.sec-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.sec-title { font-size: 18px; font-weight: 700; letter-spacing: .3px; }
.host2__follow { height: 28px; padding: 0 14px; border-radius: 999px; border: 1px solid var(--k-red-line); color: var(--k-red-deep); font-size: 13px; display: flex; align-items: center; }
.host2__follow.on { border-color: var(--k-line2); color: var(--k-muted); }
.host2__main { margin-top: 12px; display: flex; align-items: flex-start; gap: 12px; }
.host2__avatar { width: 56px; height: 56px; border-radius: 50%; flex: 0 0 auto; background: var(--k-paper2); }
.host2__copy { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.host2__name { font-size: 16px; font-weight: 700; }
.host2__score { font-size: 12px; color: var(--k-red-deep); font-weight: 600; }
.host2__intro { font-size: 13px; color: var(--k-ink2); line-height: 1.6; overflow-wrap: anywhere; }
.host2__story { margin-top: 10px; padding: 10px 12px; border-radius: 12px; background: var(--k-bg); }
.host2__story-text { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; font-size: 13px; line-height: 1.7; color: var(--k-ink2); white-space: pre-line; }
.host2__more { display: block; margin-top: 4px; font-size: 12px; color: var(--k-red-deep); font-weight: 600; }
.host2 .host-stats { font-size: 13px; }
/* 2026-10-17 R2：主理人 年龄 / 籍贯 / 擅长 一行小字（放不下换行）、小院评分 + 主理人评分并排；出行参考卡每行「标签 + 文字」 */
.host2__facts { display: flex; flex-wrap: wrap; gap: 2px 10px; }
.host2__fact { font-size: 12px; color: var(--k-ink2); line-height: 1.5; overflow-wrap: anywhere; }
.host2__scores { display: flex; flex-wrap: wrap; gap: 2px 12px; }
.trip__row { margin-top: 10px; display: flex; align-items: flex-start; gap: 10px; }
.trip__k { flex: 0 0 auto; height: 22px; padding: 0 8px; border-radius: 999px; background: var(--k-paper2); color: var(--k-ink2); font-size: 12px; font-weight: 600; line-height: 22px; }
.trip__k--good { background: var(--k-green-soft); color: var(--k-green); }
.trip__k--warn { background: var(--k-red-soft); color: var(--k-red-deep); }
.trip__v { flex: 1; min-width: 0; padding-top: 1px; font-size: 13px; line-height: 1.6; color: var(--k-ink); overflow-wrap: anywhere; }
.entries { margin-top: 12px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.entries--one { grid-template-columns: minmax(0, 1fr); }
.entry { min-width: 0; padding: 12px 10px 12px 12px; border-radius: 16px; background: var(--k-paper); box-shadow: var(--k-sh1); display: flex; align-items: center; gap: 8px; }
.entry__copy { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.entry__title { font-size: 15px; font-weight: 700; }
.entry__sub { font-size: 12px; color: var(--k-muted); }
.rooms-head { margin: 22px 0 10px; }
.rooms-head__note { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--k-muted); white-space: nowrap; }
.rooms-head__edit { margin-left: 4px; color: var(--k-red); font-weight: 700; }
/* 2026-10-18 房型卡：全宽白卡，上面 16:9 大图，下面信息；选中绿框 */
.rt { margin-bottom: 14px; border-radius: 18px; background: var(--k-paper); box-shadow: var(--k-sh1); border: 1.5px solid transparent; overflow: hidden; }
.rt.on { border-color: var(--k-green); }
.rt.off { opacity: .72; }
.rt__pic { position: relative; width: 100%; height: 0; padding-bottom: 56.25%; background: #DDD5C8; overflow: hidden; }
.rt__img { position: absolute; left: 0; top: 0; width: 100%; height: 100%; }
.rt__body { padding: 12px 14px 14px; display: flex; flex-direction: column; }
.rt__top { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-width: 0; }
.rt__name { flex: 1; min-width: 0; font-size: 17px; font-weight: 700; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.rt__rate { flex: 0 0 auto; display: flex; align-items: center; gap: 3px; }
.rt__score { font-size: 14px; font-weight: 700; color: var(--k-red-deep); font-family: var(--k-sans); }
.rt__cnt { font-size: 12px; color: var(--k-muted); white-space: nowrap; }
.rt__line { margin-top: 6px; font-size: 13px; color: var(--k-ink2); line-height: 1.5; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
.rt__foot { margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--k-line); display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.rt__left { min-width: 0; display: flex; align-items: baseline; flex-wrap: wrap; gap: 2px 10px; }
.rt__price { display: flex; align-items: baseline; white-space: nowrap; }
.rt__yen { color: var(--k-red); font-size: 13px; font-weight: 700; }
.rt__num { color: var(--k-red); font: 700 24px var(--k-display-font); line-height: 1; }
.rt__unit { color: var(--k-muted); font-size: 12px; margin-left: 2px; white-space: nowrap; flex: 0 0 auto; }
.rt__few { font-size: 12px; color: var(--k-alert); font-weight: 600; white-space: nowrap; }
.rt__few--off { color: var(--k-muted); font-weight: 400; }
.rt__few--ok { color: var(--k-green); }
.rt__btn { flex: 0 0 auto; height: 34px; padding: 0 20px; white-space: nowrap; border-radius: 999px; background: var(--k-green); color: var(--k-paper); font-size: 14px; font-weight: 700; display: flex; align-items: center; box-shadow: 0 4px 10px rgba(74, 110, 58, .22); }
.rt__btn.on { background: var(--k-green-soft); color: var(--k-green); box-shadow: none; }
.rt__btn.off { background: var(--k-paper2); color: var(--k-muted); box-shadow: none; }
.location { margin-top: 12px; padding: 12px; border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-paper); display: flex; align-items: center; gap: 10px; }.location-pin { width: 36px; height: 36px; border-radius: 50%; background: var(--k-red-soft); display: flex; align-items: center; justify-content: center; flex: 0 0 auto; }.location-copy { flex: 1; min-width: 0; overflow-wrap: anywhere; line-height: 1.5; }.location-copy>text { display: block; }.location-main { font-size: 15px; font-weight: 700; }.location-note { font-size: 12px; color: var(--k-muted); margin-top: 2px; }.stay-intro { margin-top: 20px; line-height: 1.7; font-size: 14px; white-space: pre-line; overflow-wrap: anywhere; }.stay-intro>text { display: block; }.intro-title { font-size: 18px; font-weight: 700; margin-bottom: 8px; }.slogan { margin-top: 14px; height: auto; min-height: 91px; }.title-row>view:first-child { min-width: 0; }.title-row>view:first-child>view:first-child { flex-wrap: wrap; }
/* 房型名 / Vlog 标题太长：卡片是固定高度，超出部分省略，不把价格、点赞数挤出卡片 */
.room>view, .vlog>view { min-width: 0; }
.room>view>text:first-child { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.room>view>text:nth-child(2), .vlog__title { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
.list-empty { display: block; padding: 24px 0; text-align: center; color: var(--k-muted); font-size: 13px; }
/* Vlog 评论入口：不管有没有简介都在；房型卡片左上角的早鸟价 */
.vlog-comment { margin-top: 12px; min-height: 42px; padding: 0 10px 0 12px; border: 1px solid var(--k-line); border-radius: 10px; background: var(--k-paper); display: flex; align-items: center; gap: 6px; font-size: 14px; }.vlog-comment__go { margin-left: auto; color: var(--k-muted); font-size: 12px; white-space: nowrap; }
.room { position: relative; }.room__promo { position: absolute; left: 6px; top: 6px; height: 20px; padding: 0 7px; border-radius: 5px; background: rgba(253,251,247,.95); color: var(--k-red); font-size: 11px; font-weight: 600; line-height: 20px; }
/* 2026-10-17 R3：「3分钟看小院」卡（16:9 宽封面、圆形播放按钮、底部一句说明）、生活碎片入口的缩略图、房型图上的播放按钮和「≤1分钟」角标 */
.vcard__head { margin-bottom: 10px; }
.vcard__title { display: flex; align-items: center; gap: 8px; }
.vcard__dot { width: 20px; height: 20px; border-radius: 50%; background: linear-gradient(135deg, var(--k-red-deep), #A8743F); display: flex; align-items: center; justify-content: center; }
.vcard__cover { position: relative; width: 100%; height: 0; padding-bottom: 56.25%; border-radius: 14px; overflow: hidden; background: #DDD5C8; }
.vcard__img { position: absolute; left: 0; top: 0; width: 100%; height: 100%; }
.vcard__shade { position: absolute; left: 0; right: 0; bottom: 0; height: 60%; background: linear-gradient(180deg, rgba(36,27,23,0) 0%, rgba(36,27,23,.55) 100%); }
.vcard__play { position: absolute; left: 50%; top: 50%; width: 54px; height: 54px; margin: -27px 0 0 -27px; border-radius: 50%; background: rgba(36,27,23,.45); border: 2px solid rgba(255,255,255,.85); display: flex; align-items: center; justify-content: center; box-sizing: border-box; }
.vcard__cap { position: absolute; left: 14px; right: 14px; bottom: 12px; color: var(--k-paper); font-size: 14px; font-weight: 600; letter-spacing: .3px; }
.entry__thumbs { margin-top: 6px; display: flex; gap: 4px; }
.entry__thumb { width: 30px; height: 30px; border-radius: 6px; background: var(--k-paper2); }
.rt__play { position: absolute; left: 0; right: 0; top: 0; bottom: 0; display: flex; align-items: center; justify-content: center; }
.rt__play-dot { width: 50px; height: 50px; border-radius: 50%; background: rgba(36,27,23,.45); border: 2px solid rgba(255,255,255,.85); display: flex; align-items: center; justify-content: center; box-sizing: border-box; }
/* 「≤1分钟」时长胶囊放在大图左上角（2026-10-18 效果图）；早鸟价挪到右上角 */
.rt__badge { position: absolute; left: 10px; top: 10px; height: 22px; padding: 0 9px; border-radius: 11px; background: rgba(36,27,23,.6); color: var(--k-paper); font-size: 12px; line-height: 22px; font-family: var(--k-sans); }
.rt .room__promo { left: auto; right: 10px; top: 10px; }
/* 顶栏透明时的「房源详情」标题胶囊；「住过的家人评价」入口左边的总结分 */
.bar-pill { margin-left: 4px; height: 30px; padding: 0 14px; border-radius: 999px; background: rgba(255,255,255,.82); box-shadow: 0 2px 8px rgba(58,50,43,.12); display: flex; align-items: center; font-size: 14px; font-weight: 700; color: var(--k-ink); }
.entry__score { flex: 0 0 auto; width: 44px; height: 44px; border-radius: 12px; background: var(--k-red-soft); display: flex; align-items: center; justify-content: center; }
.entry__score--none { background: var(--k-ochre-soft); }
.entry__num { font: 700 19px var(--k-display-font); color: var(--k-red-deep); letter-spacing: -.3px; }
/* ---------------------------------------------------------------------------------------------------------------
   2026-10-19 一比一还原（参考图 9）：暖米渐变底、白卡大圆角 + 柔阴影 + 细边、标题加粗加大；房型卡视频封面中央暖棕实心播放钮、
   「少量余房」绿字、「选择」深绿实心胶囊；底部暖棕整条 + 橙色渐变「立即预订」。只改样式，结构和点按行为不变。
   --------------------------------------------------------------------------------------------------------------- */
.stay-detail { background: var(--k-bg); }
.stay-detail.vlog-page { background: var(--k-bg); }
.info { border-radius: 16px; padding: 18px 16px 16px; border: $look-hairline; box-shadow: 0 4px 18px rgba(58,50,43,.06); }
.title-row>view:first-child>view:first-child>text { font-size: 22px; font-weight: 700; color: $look-ink; }
.rating text:first-child { color: $look-brown; font: 900 24px var(--k-display-font); }
.ichip { height: 24px; padding: 0 10px; }
.ichip--src { background: #F3E6D6; color: $look-chip-on-ink; }
.ichip--safe { background: $look-green-soft; color: $look-green; }
.info-price__num { color: $look-brown; font: 900 28px var(--k-display-font); letter-spacing: -.3px; }
.info-price__pill { height: 24px; padding: 0 10px; border-color: $look-chip-on-line; background: $look-chip-on-bg; color: $look-chip-on-ink; font-weight: 700; }
.location { border: 0; border-radius: 16px; background: #FBF5EC; }
.location-pin { background: var(--k-paper); box-shadow: 0 2px 6px rgba(138, 90, 48, .14); }
.sec-card { margin-top: 14px; padding: 16px; border-radius: 16px; border: $look-hairline; box-shadow: 0 3px 14px rgba(58,50,43,.04); }
.sec-title { font-size: 18px; font-weight: 700; color: $look-ink; }
.rooms-head .sec-title { font-size: 20px; font-weight: 900; }
.trip__k { height: 24px; line-height: 24px; padding: 0 10px; background: $look-chip-bg; }
.trip__k--good { background: $look-green-soft; color: $look-green; }
.trip__k--warn { background: $look-chip-on-bg; color: $look-chip-on-ink; }
.vcard__dot { background: $look-grad-brown; }
.vcard__cover { border-radius: 16px; }
.vcard__play, .rt__play-dot { width: 56px; height: 56px; margin: 0; border: 2px solid rgba(255, 255, 255, .92); background: $look-grad-brown; box-shadow: 0 6px 16px rgba(58, 36, 18, .32); }
.vcard__play { margin: -28px 0 0 -28px; }
/* 主理人卡（参考图 9）：大圆头像、名字粗大、年龄 / 籍贯 / 擅长一行行小字、两颗浅橙评分胶囊 */
.host2__avatar { width: 68px; height: 68px; border: 3px solid var(--k-paper); box-shadow: 0 4px 12px rgba(120, 84, 48, .16); }
.host2__copy { gap: 5px; }
.host2__name { font-size: 18px; font-weight: 700; color: $look-ink; }
.host2__fact { font-size: 13px; color: var(--k-ink2); }
.host2__scores { gap: 8px; margin-top: 2px; }
.host2__score { height: 24px; padding: 0 10px; border-radius: 999px; background: $look-chip-on-bg; color: $look-chip-on-ink; font-size: 12px; font-weight: 700; line-height: 24px; }
.host2__follow { height: 30px; padding: 0 16px; border-color: $look-chip-on-line; color: $look-chip-on-ink; font-weight: 700; }
.host2__story { background: #FBF5EC; }
/* 评价入口独占一行；生活碎片、Vlog 入口使用下面的双列网格。 */
.entries { gap: 8px; }
.entry { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 8px 0; padding: 14px 6px 14px 12px; border-radius: 16px; border: $look-hairline; box-shadow: 0 3px 12px rgba(58,50,43,.05); }
.entry:nth-child(2):last-child { grid-column: 1 / -1; }
.entry__copy { gap: 4px; }
.entry__title { font-size: 14px; font-weight: 700; color: $look-ink; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.entry:first-child .entry__title::before { content: none; margin-right: 3px; font-size: 13px; }
.entry + .entry .entry__title::before { content: none; margin-right: 3px; font-size: 13px; }
.entry + .entry + .entry .entry__title::before { content: none; margin-right: 3px; font-size: 13px; }
.entry__score { order: 2; grid-column: 1 / -1; width: auto; height: auto; padding: 0; background: none; justify-content: flex-start; }
.entry__score--none { width: 36px; height: 36px; border-radius: 12px; background: var(--k-ochre-soft); justify-content: center; }
.entry__num { font: 900 30px var(--k-display-font); color: $look-brown; line-height: 1; letter-spacing: -.5px; }
/* 评价分始终在左侧，生活碎片和 Vlog 不挤压综合评分。 */
.entry.entry--reviews { grid-column: 1 / -1; grid-template-columns: auto minmax(0, 1fr) auto; column-gap: 14px; padding: 16px; }
.entry--reviews .entry__score { order: 0; grid-column: auto; flex-direction: column; justify-content: center; gap: 5px; width: 68px; min-height: 68px; padding: 0; background: var(--k-red-soft); border-radius: 12px; }
.entry--reviews .entry__num { font-size: 29px; font-weight: 700; }
.entry--reviews .entry__score-label { font-size: 11px; color: var(--k-red-deep); }
.entry--reviews .entry__title { font-size: 16px; }
.entry.entry--reviews .entry__title::before { content: none; }
.entry__method { font-size: 11px; color: var(--k-muted); line-height: 1.5; }
.entry__thumbs { margin-top: 8px; gap: 5px; }
.entry__thumb { width: 42px; height: 42px; border-radius: 10px; }
/* 房型卡（参考图 9）：全宽白卡、视频封面、名称粗、规格一行、「¥6 /晚起」大字、绿色「少量余房」、深绿实心「选择」 */
.rt { margin-bottom: 16px; border-radius: 16px; border: 1px solid #E5D6C5; box-shadow: 0 3px 12px rgba(58,50,43,.05); }
.rt.on { border-color: $look-green; }
.rt__body { padding: 14px 16px 16px; }
.rt__name { font-size: 19px; font-weight: 700; color: $look-ink; white-space: normal; overflow-wrap: anywhere; }
.rt__review { min-height: 44px; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.rt__review .rt__rate { flex-wrap: wrap; }
.rt__review .rt__cnt, .rt__none { font-size: 13px; color: var(--k-muted); }
.rt__review .rt__cnt { margin-left: 5px; }
.rt__score { color: $look-brown; font-weight: 700; }
.rt__badge { left: 12px; top: 12px; height: 24px; line-height: 24px; padding: 0 10px; border-radius: 12px; background: rgba(28, 22, 18, .66); font-weight: 600; }
.rt__line { margin-top: 2px; font-size: 14px; color: var(--k-ink2); }
.rt__foot { margin-top: 12px; padding-top: 12px; border-top-color: #F2ECE4; }
.rt__yen { color: $look-brown; font-size: 14px; font-weight: 700; }
.rt__num { color: $look-brown; font: 900 28px var(--k-display-font); letter-spacing: -.3px; }
.rt__few, .rt__few--ok { color: $look-green; font-weight: 700; }
.rt__few--off { color: var(--k-muted); font-weight: 400; }
.rt__btn { height: 44px; padding: 0 24px; background: $look-green; font-size: 15px; font-weight: 700; letter-spacing: 1px; box-shadow: none; }
.rt__btn.on { background: $look-green-soft; color: $look-green; box-shadow: none; }
/* 底部：暖棕预订栏 + 杏色「立即预订」。 */
.pickbar { padding: 10px 10px 10px 16px; border-radius: 16px; background: var(--k-red); box-shadow: 0 4px 14px rgba(58,50,43,.12); }
.picked__text { font-size: 13px; font-weight: 700; }
.picked__from { font: 700 19px var(--k-display-font); }
.book { height: 46px; padding: 0 22px; background: #F3BD78; box-shadow: none; }
.book__main { color: var(--k-ink); font-size: 16px; font-weight: 700; letter-spacing: 1px; }
.bar-pill { font-weight: 700; }
/* 10-19 标题字体（--k-display-font，只有 700 / 900 两档）：整页正文用系统黑体，下面这些标题、价格大数字单独用标题字体
   （之前整页 font-family 是 --k-serif，那时它等于系统黑体；现在 --k-serif 指向标题字体，整页挂着会把正文也变成粗体） */
.title-row>view:first-child>view:first-child>text, .slogan>view text:first-child, .host-title, .section-head>text, .room>view>text:first-child, .vlog__title, .guest-review>view text:first-child, .vlog-detail__title, .vlog-review-link>text, .intro-title, .sec-title, .host2__name, .entry__title, .rt__name, .bar-pill, .book__main { font-family: var(--k-display-font); }
/* 320 宽：大标题、小节标题收一档，「可选空余房型」不折行；两张入口卡标题小一号 */
@media (max-width: 359px) { .title-row>view:first-child>view:first-child>text { font-size: 20px; } .rooms-head .sec-title { font-size: 17px; white-space: nowrap; } .rooms-head__note { white-space: normal; flex-wrap: wrap; justify-content: flex-end; } .entry__title { font-size: 13px; } .entry:first-child .entry__title::before, .entry + .entry .entry__title::before { margin-right: 2px; font-size: 12px; } }
/* 10-19 复查：320 宽两张入口卡并排时一张只有一百四十来像素，「图标 + 住过的家人评价」放不下被省略成「住过的家人…」—— 窄屏去掉标题前的小图标，标题完整显示 */
@media (max-width: 359px) { .entries:not(.entries--one) .entry .entry__title::before { display: none; } }
/* 2026-10-23：上半部按小院原稿，下半部按纵向房型原稿；真实房型评价单独成行。 */
@import './stays-premium.scss';
.stay-detail { @include stays-surface; --k-paper: #fffefd; --k-ink: #563c31; --k-ink2: #644a3c; background: #faf4ef; }
.overview { padding-bottom: calc(110px + var(--k-safe-bottom)); }
.hero { height: 214px; }
.hero-fade { top: auto; bottom: 0; height: 55px; background: linear-gradient(180deg,transparent,#faf4ef); pointer-events: none; }
.hero-count { right: 17px; bottom: 39px; }
.hero-actions { position: absolute; right: 14px; display: flex; align-items: center; padding: 0 3px; height: 34px; border-radius: 20px; background: rgba(44,30,22,.62); }
.hero-action { width: 37px; height: 34px; display: flex; align-items: center; justify-content: center; }
.hero-actions__line { width: 1px; height: 17px; background: rgba(255,255,255,.4); }
.bar-pill { position: absolute; left: 50%; margin: 0; transform: translateX(-50%); height: 32px; padding: 0 20px; font-size: 15px; letter-spacing: 1px; color: #442c23; background: var(--k-paper); }
.bar-title { position: absolute; left: 50%; transform: translateX(-50%); font-size: 16px; font-weight: 700; color: #563c31; }
.stay-detail--solid :deep(.k-topbar) { background: #faf4ef !important; }
.stay-detail.vlog-page :deep(.k-topbar) { background: #151311 !important; }
.overview-body { padding: 0 13px 14px; }
.info { margin: -34px 13px 0; padding: 12px; border: 1px solid #eee3db; border-radius: 13px; background: var(--k-paper); box-shadow: 0 3px 6px rgba(72,44,27,.14); }
.title-row { align-items: center; gap: 8px; }
.title-row>view:first-child>view:first-child>text { font-size: 21px; line-height: 1.3; color: #56392d; letter-spacing: .2px; }
.title-actions { gap: 8px; padding: 0; }
.title-actions>view { min-height: 30px; min-width: 26px; justify-content: center; }
.title-actions>view>text { display: none; }
.info-meta { margin-top: 5px; gap: 8px; align-items: center; }
.info-meta__copy { flex: 1; min-width: 0; }
.info-chips,.info-meta__copy .info-chips { margin: 0; gap: 4px; }
.ichip { height: 17px; padding: 0 4px; border-radius: 5px; font-size: 9.5px; background: #f2efed; color: #5e4940; white-space: nowrap; }
.ichip--src { background: #f5e0c6; color: #88532b; font-weight: 700; }
.ichip--safe { background: #f2efed; color: #5e4940; }
.info-meta__copy .rating { min-height: 24px; margin-top: 3px; }
.info-meta__copy .rating text:first-child { font-size: 14px; }
.info-meta__copy .rating text:nth-child(2) { margin-left: 0; font-size: 11px; color: #8b6a53; }
.info-price { gap: 4px; }
.info-price__row,.info-price__num { line-height: 1; }
.info-price__num { font-size: 27px; color: #8c542f; }
.info-price__unit { font-size: 10px; color: #7c583c; }
.info-price__pill { height: 17px; padding: 0 7px; border: 0; font-size: 10px; background: #fbecd9; }
.location { margin-top: 7px; padding: 8px 0 0; gap: 5px; background: transparent; border: 0; border-top: 1px solid #ece6e1; border-radius: 0; }
.location-pin { width: 19px; height: 26px; background: transparent; box-shadow: none; }
.location-area,.location-main { font-size: 11px; font-weight: 600; line-height: 1.5; color: #563c31; }
.location-action { flex: 0 0 auto; height: 25px; padding: 0 7px; border: 1px solid #b79170; border-radius: 999px; display: flex; align-items: center; gap: 4px; font-size: 10px; color: #885e3f; }
.sec-card { margin-top: 7px; padding: 9px 14px; border: 1px solid #eee4dd; border-radius: 13px; background: var(--k-paper); box-shadow: 0 2px 5px rgba(72,44,27,.12); }
.sec-title { font-size: 16px; line-height: 1.4; color: #77482d; letter-spacing: 0; }
.trip .sec-head { margin-bottom: 5px; }
.trip__row { gap: 2px; margin-top: 2px; }
.trip__k { padding: 0; height: auto; line-height: 1.55; border-radius: 0; background: transparent; color: #8b582f; font-size: 11px; }
.trip__k::after { content: '：'; }
.trip__v { padding: 0; font-size: 11px; line-height: 1.55; color: #513a2e; }
.vcard { padding: 0; overflow: hidden; background: linear-gradient(100deg,#ad7947,#86502b); }
.vcard__head { padding: 6px 13px; margin: 0; }
.vcard__title { gap: 6px; }
.vcard__title .sec-title { color: #fff8ed; font-size: 16px; }
.vcard__dot { background: transparent; width: 16px; }
.vcard__cover { box-sizing: border-box; padding-bottom: 29%; border-radius: 10px; border: 1px solid #c49a70; }
.vcard__cap { left: 14px; bottom: 5px; font-size: 11px; font-weight: 500; }
.vcard__play,.rt__play-dot { width: 42px; height: 42px; border: 1px solid #f6dfc3; box-shadow: none; background: #a96b31; }
.vcard__play { margin: -21px 0 0 -21px; }
/* 2026-11-03 主人：「文字奇怪，优化一下文字布局」——之前名字和年龄 / 籍贯挤在一行小字里、头像比字低一截、擅长单独掉一行。
   改成：头像和文字顶对齐；名字单独一行大一号；年龄、籍贯一行灰字；擅长另起一行带「擅长」小标；故事框字号、行距跟正文一致 */
.host2 { padding: 10px 14px 12px; }
.host2 .sec-title { color: #55382c; }
.host2__main { gap: 12px; margin-top: 8px; align-items: flex-start; }
.host2__avatar { width: 52px; height: 52px; margin-top: 0; border: 1px solid #e4d8c8; box-shadow: none; }
.host2__copy { display: flex; flex-direction: column; gap: 4px; padding-top: 2px; }
.host2__name { display: block; margin: 0; font-size: 16px; line-height: 1.3; }
.host2__facts { display: flex; flex-wrap: wrap; gap: 2px 12px; }
.host2__fact { display: block; margin: 0; font-size: 13px; line-height: 1.5; color: #6b5242; }
.host2__fact--wide { flex: 0 0 100%; }
.host2__scores { margin: 2px 0 0; gap: 6px; }
.host2__score { padding: 0 8px; height: 20px; line-height: 20px; font-size: 11px; background: #f9e9d3; }
.host2__intro { display: block; font-size: 13px; line-height: 1.6; width: auto; margin: 0; color: #5b3f32; }
.host2__follow { height: 26px; padding: 0 12px; font-size: 12px; }
.host2 .host-stats { display: none; }
.host2__story { margin-top: 10px; padding: 10px 12px; }
.host2__story-text { font-size: 14px; line-height: 1.7; -webkit-line-clamp: 2; }
.host2__more { margin-top: 6px; font-size: 13px; }
.room-section { margin-top: 7px; padding: 0 9px 10px; background: var(--k-paper); border: 1px solid #eee4dd; border-radius: 13px; box-shadow: 0 2px 5px rgba(72,44,27,.07); }
.entries { margin-top: 0; gap: 7px; grid-template-columns: minmax(0,1fr) minmax(0,1fr); }
.entries--one { grid-template-columns: minmax(0,1fr); }
.entry,.entry.entry--reviews { padding: 8px 7px; border-radius: 9px; border: 1px solid #eae3df; box-shadow: 0 2px 4px rgba(72,44,27,.07); background: var(--k-paper); grid-column: auto; display: flex; flex-direction: column; align-items: stretch; gap: 5px; }
.entry:nth-child(2):last-child { grid-column: auto; }
.entry + .entry { background: linear-gradient(130deg,var(--k-paper),#f2f0f4); }
.entry > .k-icon { display: none; }
.entry__copy { flex: none; order: 0; gap: 6px; }
.entry__title,.entry.entry--reviews .entry__title { font-size: 14px; line-height: 1.5; white-space: nowrap; overflow: visible; letter-spacing: -.2px; color: #5b3a2b; }
.entry .entry__title::before { content: none !important; }
.entry__sub { font-size: 11px; line-height: 1.5; color: #725541; }
.entry--reviews .entry__sub { display: none; }
.entry--reviews .entry__score { order: 1; width: auto; min-height: 25px; height: auto; padding: 2px 7px; flex-direction: row; justify-content: flex-start; gap: 5px; border-radius: 7px; background: #fbefe3; }
.entry--reviews .entry__num { font-size: 16px; line-height: 1.2; }
.entry--reviews .entry__score-label { font-size: 11px; color: #855832; }
.entry--reviews .entry__score--none .entry__num { display: none; }
.entry__method { font-size: 10px; line-height: 1.4; }
.entry__thumbs { display: none; }
.rooms-head { flex-wrap: wrap; margin: 12px 1px 8px; gap: 5px; }
.rooms-head .sec-title { font-size: 18px; color: #583a2c; }
.rooms-head__note { width: 100%; padding: 5px 7px; border-radius: 6px; background: #faf5ef; font-size: 11px; justify-content: flex-end; color: #8a6c56; }
.rooms-head__note>text:first-child { margin-right: auto; }
.rooms-head__edit { display: inline; margin-left: 0; color: #895c35; }
.rt { margin-bottom: 9px; border: 1px solid #aa7d53; border-radius: 10px; background: #fffdfb; box-shadow: 0 2px 3px rgba(77,46,26,.12); }
.rt:last-child { margin-bottom: 0; }
.rt.on { border-color: #178057; box-shadow: 0 0 0 1px #178057; }
.rt.off { opacity: 1; }
.rt__pic { padding-bottom: 42%; }
.rt__pic { border-radius: 9px; }
.rt__body { padding: 7px 12px 9px; }
.rt__name { font-size: 19px; line-height: 1.35; color: #633e2c; white-space: normal; }
.rt__line { margin-top: 4px; font-size: 13px; line-height: 1.5; color: #6a4836; font-weight: 600; }
.rt__review { min-height: 32px; margin-top: 3px; border: 0; gap: 4px; }
.rt__review .rt__rate { min-width: 0; flex: 1; gap: 3px; flex-wrap: wrap; }
.rt__score { font-size: 12px; }
.rt__review .rt__cnt { margin-left: 3px; font-size: 11px; color: #93735c; }
.rt__none { font-size: 11px; color: #a58a74; }
.rt__review-go { flex: 0 0 auto; display: flex; align-items: center; gap: 2px; color: #976c46; font-size: 10px; }
.rt__foot { border: 0; margin-top: 2px; padding: 0; }
.rt__left { flex: 1; gap: 3px 12px; }
.rt__yen { font-size: 14px; }
.rt__num { font-size: 29px; font-weight: 700; }
.rt__yen,.rt__num,.rt__unit { color: #8b512b; }
.rt__unit { font-size: 11px; }
.rt__few { font-size: 11px; color: #27845c; }
.rt__few--off { white-space: normal; color: #998374; font-weight: 400; }
.rt__few--ok { display: none; }
.rt__btn { height: 28px; min-width: 53px; padding: 0 12px; justify-content: center; letter-spacing: 0; background: #138654; font-size: 13px; box-shadow: 0 2px 3px rgba(15,107,67,.13); }
.rt__btn.on { background: #e1f1e7; color: #13754c; }
.rt__btn.off { background: #eeeae6; color: #9b9188; box-shadow: none; }
.rt__badge { left: 10px; top: 8px; height: 21px; line-height: 21px; background: rgba(133,81,36,.85); border-radius: 999px; padding: 0 9px; font-size: 12px; font-weight: 500; }
.stay-booking-dock { position: fixed; z-index: 50; left: 13px; right: 13px; bottom: calc(7px + var(--k-safe-bottom)); }
.pickbar { box-sizing: border-box; border-radius: 999px; min-height: 64px; padding: 9px 10px 9px 19px; gap: 8px; background: linear-gradient(105deg,#b4885c,#795030); box-shadow: 0 3px 7px rgba(98,56,28,.22); }
.book { height: 44px; padding: 0 23px; background: linear-gradient(100deg,#ffcf59,#ff881d); }
.book__main { font-size: 19px; color: white; letter-spacing: 0; }
.picked__from { font-size: 23px; }
.picked__hint { font-size: 11px; margin-top: 2px; }
.picked__text { font-weight: 500; font-size: 12px; line-height: 1.5; }
.picked__price { font-size: 10px; }
@media(max-width:359px) {
 .info { padding: 10px; } .title-row>view:first-child>view:first-child>text { font-size: 19px; }
 .info-meta { gap: 5px; } .ichip { font-size: 9px; padding: 0 4px; } .info-price__num { font-size: 24px; }
 .location-action { padding: 0 5px; font-size: 9px; } .location-main,.location-area { font-size: 10px; }
 .room-section { padding-left: 7px; padding-right: 7px; }
 .entry__title,.entry.entry--reviews .entry__title { font-size: 12px; letter-spacing: -.4px; }
 .entry__sub,.entry--reviews .entry__score-label { font-size: 10px; }
 .host2__scores { gap: 3px; } .host2__score { font-size: 9px; }
 .rt__body { padding-left: 10px; padding-right: 10px; } .rt__name { font-size: 18px; } .rt__line { font-size: 12px; }
 .rt__review-go { font-size: 9px; } .rt__review .rt__cnt { font-size: 10px; } .rt__btn { min-width: 48px; padding: 0 10px; }
 .pickbar { padding-left: 16px; } .book { padding: 0 17px; } .book__main { font-size: 17px; }
}
@import './detail-reference.scss';
/* ---------------------------------------------------------------------------------------------------------------
   2026-11-03 主人截图反馈（放在参考稿样式后面，覆盖它）
   --------------------------------------------------------------------------------------------------------------- */
/* 「房源详情往上移一点」：胶囊离顶多少由 pillStyle 按微信胶囊的位置算（和 ··· ◎ 同一行、同样 32px 高），这里只做水平居中 */
.bar-pill { top: 6px; height: 32px; transform: translateX(-50%); }
.bar-title { top: 6px; height: 32px; line-height: 32px; }
/* 「立即预订往下移一点，移到底部」「预定往下」：预订栏贴到屏幕最下面 —— 整条从屏幕底边起、铺页面底色（内容不再从栏下面的空当露出来），
   暖棕胶囊本身样子不变。全面屏 iPhone 底部有横条时只让出一半安全区：横条只占最下面十来像素，胶囊落在它上面，不会压到 */
.stay-booking-dock { left: 0; right: 0; bottom: 0; padding: 10px 13px calc(8px + env(safe-area-inset-bottom) * .5); background: linear-gradient(180deg, rgba(250,243,237,0) 0, #FAF3ED 12px); }
/* 「住过的家人评价 / 近期生活碎片」两张小卡和「可选空余房型」标题太挤：白卡里四周留边，小卡不再贴边、内边距放大，小节标题上下多留空 */
.room-section { margin-top: 8px; padding: 10px 10px 12px; border-radius: 14px; }
.entries { margin: 0; gap: 8px; }
.entry,.entry.entry--reviews { min-height: 60px; padding: 9px 10px; gap: 5px; justify-content: center; }
.entry__copy { gap: 4px; }
.rooms-head { margin: 16px 2px 10px; }
/* 「图片变小，文字间距」：房型图从 38% 压到 26%（一般手机上约 85px 高）；房型名、规格、分隔线、价格 + 余房、「选择」上下留匀、左右对齐 */
.room-stack { gap: 12px; }
.rt__pic { padding-bottom: 26%; }
.rt__play-dot { width: 36px; height: 36px; }
.rt__body { padding: 12px 14px; }
.rt__name { font-size: 18px; line-height: 1.35; }
.rt__line { margin: 4px 0 0; line-height: 1.5; }
.rt__review { min-height: 28px; margin: 8px 0 0; }
.rt__foot { flex-wrap: nowrap; align-items: center; gap: 12px; margin-top: 10px; padding-top: 10px; }
.rt__left { align-items: baseline; gap: 4px 10px; }
.rt__btn { min-width: 72px; height: 36px; padding: 0 18px; font-size: 14px; }
/* 进行中活动横滑展示，往期活动只保留二级页面入口。 */
.acts { margin-top: 14px; }
.acts__head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin: 0 2px 8px; }
.acts__head .sec-title { font-size: 17px; color: #583a2c; }
.acts__head .sec-title::before { content: none; margin-right: 4px; }
.acts__toggle { display: flex; align-items: center; gap: 4px; min-height: 44px; font-size: 14px; font-weight: 600; color: #895c35; white-space: nowrap; }
.acts--entry .acts__head { margin-bottom: 0; }
.acts__scroll { width: 100%; white-space: nowrap; }
.acts__row { display: inline-flex; gap: 10px; padding: 2px 2px 4px; } /* inline-flex：按卡片总宽撑开，横滑到底右边的留白也算进去（和 support.vue 横滑胶囊同一写法） */
.act { flex: 0 0 auto; width: 148px; border: 1px solid #EADBCA; border-radius: 12px; background: #FFFDFB; overflow: hidden; white-space: normal; }
.act__pic { position: relative; height: 84px; background: #ECE2D6; }
.act__img { display: block; width: 100%; height: 100%; }
.act__limit,.act__state { position: absolute; left: 6px; top: 6px; height: 20px; padding: 0 7px; border-radius: 999px; color: var(--k-paper); font-size: 11px; line-height: 20px; }
.act__limit { background: linear-gradient(100deg, #F08A32, #D2581C); font-weight: 700; }
.act__state { background: rgba(60,40,28,.66); }
.act__body { padding: 7px 9px 9px; display: flex; flex-direction: column; gap: 3px; }
.act__title { min-height: 36px; font-size: 13px; font-weight: 700; line-height: 1.4; color: #563C31; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
.act__when { font-size: 11px; color: #8B6A53; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.act__foot { margin-top: 2px; display: flex; align-items: baseline; justify-content: space-between; gap: 6px; }
.act__price { font: 700 16px var(--k-display-font); color: #8B512B; white-space: nowrap; }
.act__price--free { font-size: 14px; color: #27845C; }
.act__deadline { min-width: 0; font-size: 11px; color: #B4561F; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
@media(max-width:359px) { .act { width: 136px; } .rt__btn { min-width: 60px; padding: 0 12px; } .rt__body { padding: 10px 12px; } }

.stay-period-options, .type-main > .stay-period-options { display: block; margin: 4px 0 0; color: var(--k-muted); font-size: 12px; line-height: 1.55; white-space: pre-line; text-align: left; overflow-wrap: anywhere; }

/* 2026-11-17 改版「小而精」（主人按样张第三版拍板）：顶部大图完整露出（不再盖白雾、信息卡只往上叠 14px），下面接一张白色内容面板；
   其余每块是浅灰底上的纯白卡（12 圆角，不描边不加阴影）。房型卡收成左图右文的小卡；评价 / 生活碎片 / Vlog 入口做成带小图标方块的内容卡；
   底部预订条改成白底 + 42 高的暖棕胶囊钮。标题都换回系统黑体，去掉标题前的表情符号、纸纹底和棕色描边。
   功能和文字一样不少；上面几轮的规则保留不动，这里统一用 .stay-detail 开头的规则盖过去。 */
.stay-detail { @include stays-fine; }
.stay-detail--solid :deep(.k-topbar) { background: var(--k-paper) !important; box-shadow: 0 .5px 0 rgba(20,14,10,.08); }
.stay-detail .bar-title { color: var(--k-ink); font-family: var(--k-serif); font-size: 17px; font-weight: 700; }
.stay-detail .bar-pill { padding: 0 14px; background: var(--sd-veil); box-shadow: none; color: var(--k-ink); font-family: var(--k-sans); font-size: 14px; font-weight: 600; letter-spacing: 0; }
/* 大图上的返回箭头垫一个白色小圆（看上去 32，可点范围 40），深色照片上也看得清 */
.stay-detail:not(.stay-detail--solid) :deep(.k-navbar__back) { width: 40px; height: 40px; margin-left: 0; border: 4px solid transparent; border-radius: 50%; background: var(--sd-veil) padding-box; }
.stay-detail:not(.stay-detail--solid) :deep(.k-navbar__back .k-icon) { width: 20px !important; height: 20px !important; }
/* —— 头图 —— */
.stay-detail .overview { padding-bottom: calc(96px + var(--k-safe-bottom)); } /* 底部预订条选了房型后有三行字，留足高度不压住最后一张房型卡 */
.stay-detail .hero-box { background: var(--k-paper2); }
.stay-detail .hero { height: 264px; }
.stay-detail .hero-fade { height: 0; background: transparent; }
.stay-detail .hero-count { right: 12px; bottom: 26px; height: 20px; padding: 0 8px; border-radius: 10px; background: rgba(20,14,10,.5); font-size: 11px; line-height: 20px; }
.stay-detail .hero-actions { right: 12px; height: 32px; padding: 0 2px; border-radius: 16px; background: var(--sd-shade); }
.stay-detail .hero-action { width: 36px; height: 32px; }
.stay-detail .hero-action .stay-share-icon { width: 18px !important; height: 18px !important; }
.stay-detail .hero-actions__line { height: 14px; background: rgba(255,255,255,.3); }
/* —— 白色内容面板：名字、标签、评分、价格、地址 —— */
.stay-detail .info { margin: -14px 0 0; padding: 14px 12px 12px; border: 0; border-radius: 16px 16px 0 0; background: var(--k-paper); box-shadow: none; }
.stay-detail .title-row { align-items: flex-start; gap: 8px; min-height: 0; }
.stay-detail .title-row>view:first-child>view:first-child>text { color: var(--k-ink); font-family: var(--k-sans); font-size: 18px; font-weight: 700; line-height: 26px; letter-spacing: 0; }
.stay-detail .title-actions { gap: 0; margin: -5px -8px 0 0; padding: 0; }
.stay-detail .title-actions>view { min-width: 36px; min-height: 36px; justify-content: center; color: var(--k-ink2); }
.stay-detail .title-actions .stay-share-icon { width: 20px !important; height: 20px !important; }
.stay-detail .info-meta { display: block; margin-top: 6px; }
.stay-detail .info-meta__copy { padding-right: 0; }
.stay-detail .info-chips, .stay-detail .info-meta__copy .info-chips { gap: 4px; margin: 0; }
.stay-detail .ichip { height: 17px; padding: 0 5px; border-radius: 4px; background: var(--k-fill); color: var(--k-ink2); font-size: 10px; font-weight: 500; }
.stay-detail .ichip--src { background: var(--k-red-soft); color: var(--k-red-deep); font-weight: 500; }
.stay-detail .ichip--safe { background: var(--k-green-soft); color: var(--k-green); font-weight: 500; }
.stay-detail .info-meta__copy .rating { min-height: 28px; margin-top: 4px; align-items: center; }
.stay-detail .info-meta__copy .rating text:first-child { color: var(--k-red-deep); font-family: var(--k-sans); font-size: 14px; font-weight: 700; line-height: 20px; }
.stay-detail .info-meta__copy .rating text:nth-child(2) { margin-left: 0; color: var(--k-muted); font-size: 12px; }

.stay-detail .info-price { position: static; flex-direction: row; align-items: center; justify-content: space-between; gap: 8px; margin-top: 2px; }
.stay-detail .info-price__row { align-items: baseline; }
.stay-detail .info-price__num { color: var(--k-red-deep); font-family: var(--k-sans); font-size: 22px; font-weight: 700; line-height: 28px; letter-spacing: 0; }
.stay-detail .info-price__unit { margin-left: 4px; color: var(--k-muted); font-size: 11px; }
.stay-detail .info-price__pill { height: 26px; padding: 0 10px; border: 1px solid var(--k-red-line); border-radius: 13px; background: var(--k-paper); color: var(--k-red-deep); font-size: 12px; font-weight: 500; }
.stay-detail .stay-period-options { margin-top: 2px; font-size: 11px; line-height: 16px; }
.stay-detail .week-price-note { margin: 6px 0 0; color: var(--k-muted); font-size: 11px; line-height: 16px; }
.stay-detail .info-promo { margin-top: 8px; }
.stay-detail .location { align-items: center; gap: 6px; margin-top: 10px; padding: 10px 0 0; border: 0; border-top: 1px solid var(--k-line); border-radius: 0; background: transparent; }
.stay-detail .location-pin { width: 16px; height: 20px; background: transparent; box-shadow: none; }

.stay-detail .location-area { color: var(--k-muted); font-size: 11px; font-weight: 400; line-height: 16px; }
.stay-detail .location-main { color: var(--k-ink); font-size: 13px; font-weight: 500; line-height: 19px; }
.stay-detail .location-action { height: 26px; min-height: 26px; padding: 0 10px; gap: 3px; border: 1px solid var(--k-red-line); border-radius: 13px; color: var(--k-red-deep); font-size: 11px; }

.stay-detail .rooms-state { font-size: 12px; }
.stay-detail .rooms-state__retry { min-height: 28px; padding: 0 14px; border-radius: 14px; font-size: 12px; }
/* —— 下面各块：浅灰底上的白卡 —— */
.stay-detail .overview-body { padding: 0 12px 12px; }
.stay-detail .slogan { height: auto; min-height: 0; margin-top: 8px; padding: 12px; gap: 10px; border: 0; border-radius: 12px; background: var(--k-paper); }
.stay-detail .slogan>view text:first-child { font-family: var(--k-sans); font-size: 15px; font-weight: 600; line-height: 21px; }
.stay-detail .slogan>view text:last-child { margin-top: 3px; color: var(--k-muted); font-size: 11px; line-height: 16px; }
.stay-detail .slogan image { width: 66px; height: 48px; border-radius: 8px; }
.stay-detail .sec-card { margin-top: 8px; padding: 12px; border: 0; border-radius: 12px; background: var(--k-paper); box-shadow: none; }
.stay-detail .sec-head { gap: 8px; }
.stay-detail .sec-head>text + text { flex: 0 0 auto; color: var(--k-muted); font-size: 12px; }
.stay-detail .sec-title { color: var(--k-ink); font-family: var(--k-sans); font-size: 15px; font-weight: 700; line-height: 21px; letter-spacing: 0; }
.stay-detail .sec-title::before { content: none; }
.stay-detail .section-pending { margin: 6px 0 0; color: var(--k-muted); font-size: 12px; line-height: 18px; }
/* 出行参考：小标签 + 一行行说明 */
.stay-detail .trip .sec-head { margin-bottom: 6px; }
.stay-detail .trip__row { align-items: flex-start; gap: 8px; margin-top: 6px; }
.stay-detail .trip__k { flex: 0 0 auto; height: 17px; margin-top: 2px; padding: 0 5px; border-radius: 4px; background: var(--k-fill); color: var(--k-ink2); font-size: 10px; font-weight: 500; line-height: 17px; }
.stay-detail .trip__k::after { content: none; }
.stay-detail .trip__k--good { background: var(--k-green-soft); color: var(--k-green); }
.stay-detail .trip__k--warn { background: var(--k-ochre-soft); color: var(--k-ochre-deep); }
.stay-detail .trip__v { padding: 0; color: var(--k-ink2); font-size: 13px; font-weight: 400; line-height: 20px; }
/* 3 分钟看小院：白卡 + 2:1 封面，说明字压在封面底部的黑色渐变上 */
.stay-detail .vcard { padding: 12px; background: var(--k-paper); }
.stay-detail .vcard__head { margin: 0 0 8px; padding: 0; }
.stay-detail .vcard__title { gap: 6px; }
.stay-detail .vcard__title .sec-title { color: var(--k-ink); font-size: 15px; letter-spacing: 0; }
.stay-detail .vcard__dot { width: 18px; height: 18px; background: linear-gradient(135deg,#B5814D,#8E5E33); }

.stay-detail .vcard__cover { padding-bottom: 50%; border: 0; border-radius: 8px; background: var(--k-paper2); }
.stay-detail .vcard__shade { height: 50%; background: linear-gradient(transparent, rgba(20,14,10,.6)); }
.stay-detail .vcard__play { width: 40px; height: 40px; margin: -20px 0 0 -20px; border: 0; background: rgba(20,14,10,.5); box-shadow: none; }

.stay-detail .vcard__cap { left: 10px; right: 10px; bottom: 8px; font-size: 12px; font-weight: 500; letter-spacing: 0; }
.stay-detail .vcard--pending { background: var(--k-paper); }
.stay-detail .video-pending { min-height: 72px; gap: 6px; border-radius: 8px; background: var(--k-page); color: var(--k-muted); font-size: 12px; }

/* 当地主理人 */
.stay-detail .host2 { padding: 12px; }
.stay-detail .host2__follow { height: 26px; padding: 0 12px; border: 1px solid var(--k-red-line); border-radius: 13px; color: var(--k-red-deep); font-size: 12px; font-weight: 500; }
.stay-detail .host2__follow.on { border-color: var(--k-line2); color: var(--k-muted); }
.stay-detail .host2__main { gap: 10px; margin-top: 10px; }
.stay-detail .host2__avatar { width: 44px; height: 44px; margin-top: 0; border: 0; box-shadow: none; }
.stay-detail .host2__copy { gap: 3px; padding-top: 0; }
.stay-detail .host2__name { color: var(--k-ink); font-family: var(--k-sans); font-size: 14px; font-weight: 600; line-height: 20px; }
.stay-detail .host2__name::before { color: var(--k-muted); font-weight: 400; }
.stay-detail .host2__facts { gap: 0 10px; }
.stay-detail .host2__fact { color: var(--k-muted); font-size: 12px; font-weight: 400; line-height: 18px; }
.stay-detail .host2__scores { justify-content: flex-start; gap: 4px; margin: 2px 0 0; }
.stay-detail .host2__score { height: 17px; padding: 0 5px; border-radius: 4px; background: var(--k-red-soft); color: var(--k-red-deep); font-size: 10px; font-weight: 500; line-height: 17px; }
.stay-detail .host2__intro { color: var(--k-ink2); font-size: 13px; font-weight: 400; line-height: 20px; }
.stay-detail .host2__story { margin-top: 10px; padding: 10px; border-radius: 8px; background: var(--k-page); }
.stay-detail .host2__story-text { color: var(--k-ink2); font-size: 13px; line-height: 20px; }
.stay-detail .host2__more { margin-top: 4px; color: var(--k-red-deep); font-size: 12px; font-weight: 500; }
/* 评价 / 生活碎片 / Vlog 入口：两列内容卡，左上角一个 32 的小图标方块（很浅的同色渐变底），下面是评分或一句说明 */
.stay-detail .room-section { margin-top: 8px; padding: 0; border: 0; border-radius: 0; background: transparent; box-shadow: none; }
.stay-detail .entries { gap: 8px; margin: 0; }
.stay-detail .entry, .stay-detail .entry.entry--reviews { position: relative; min-height: 0; padding: 10px; gap: 0; justify-content: flex-start; border: 0; border-radius: 12px; background: var(--k-paper); box-shadow: none; }
.stay-detail .entry + .entry { background: var(--k-paper); }
/* 有第三张入口卡（Vlog）时让它占满一行，不在左边孤零零留半行 */
.stay-detail .entry + .entry + .entry { grid-column: 1 / -1; }
.stay-detail .entry__copy { gap: 0; }
.stay-detail .entry__title, .stay-detail .entry.entry--reviews .entry__title { display: block; padding-left: 40px; color: var(--k-ink); font-family: var(--k-sans); font-size: 14px; font-weight: 600; line-height: 32px; letter-spacing: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.stay-detail .entry .entry__title::before, .stay-detail .entry.entry--reviews .entry__title::before, .stay-detail .entry--diary .entry__title::before { content: none !important; }
.stay-detail .entry__sub { margin-top: 6px; color: var(--k-muted); font-size: 11px; line-height: 18px; }
.stay-detail .entry--reviews .entry__score { order: 1; min-height: 18px; margin-top: 6px; padding: 0; gap: 4px; align-items: baseline; border-radius: 0; background: transparent; }
.stay-detail .entry--reviews .entry__num { color: var(--k-red-deep); font-family: var(--k-sans); font-size: 15px; font-weight: 700; line-height: 18px; letter-spacing: 0; }
.stay-detail .entry--reviews .entry__score-label { color: var(--k-muted); font-size: 11px; line-height: 18px; }
/* 小院活动：白卡里横滑的小卡片 */
.stay-detail .acts { margin-top: 8px; padding: 12px 0 12px 12px; border-radius: 12px; background: var(--k-paper); }
.stay-detail .acts__head { margin: 0 4px 8px 0; }
.stay-detail .acts--entry .acts__head { margin-bottom: 0; }
.stay-detail .acts__head .sec-title { color: var(--k-ink); font-size: 15px; }
.stay-detail .acts__toggle { min-height: 36px; margin: -8px 0; padding: 0 4px; gap: 1px; color: var(--k-muted); font-size: 12px; font-weight: 400; }

.stay-detail .acts__row { gap: 8px; padding: 0 12px 0 0; }
.stay-detail .act { width: 140px; border: 0; border-radius: 8px; background: var(--k-page); }
.stay-detail .act__pic { background: var(--k-paper2); }
.stay-detail .act__limit, .stay-detail .act__state { left: 4px; top: 4px; height: 17px; padding: 0 5px; border-radius: 4px; font-size: 10px; font-weight: 500; line-height: 17px; }
.stay-detail .act__limit { background: var(--k-alert); color: var(--k-paper); }
.stay-detail .act__state { background: rgba(255,255,255,.94); color: var(--k-ink2); }
.stay-detail .act__body { padding: 6px 8px 8px; gap: 2px; }
.stay-detail .act__title { min-height: 36px; color: var(--k-ink); font-family: var(--k-sans); font-size: 13px; font-weight: 600; line-height: 18px; }
.stay-detail .act__when { color: var(--k-muted); font-size: 11px; line-height: 16px; }
.stay-detail .act__price { color: var(--k-red-deep); font-family: var(--k-sans); font-size: 13px; font-weight: 700; }
.stay-detail .act__price--free { color: var(--k-green); font-size: 13px; }
.stay-detail .act__deadline { color: var(--k-alert); font-size: 10px; }
/* 可选空余房型：标题和「日期 · 晚数 · 人数 改日期」排一行（放不下自动换行） */
.stay-detail .rooms-head { flex-wrap: wrap; gap: 6px 8px; margin: 14px 0 8px; }
.stay-detail .rooms-head .sec-title { font-size: 16px; line-height: 22px; white-space: nowrap; }
.stay-detail .rooms-head__note { width: auto; min-height: 28px; margin-left: auto; padding: 0 8px 0 10px; gap: 3px; border-radius: 14px; background: var(--k-paper); color: var(--k-ink2); font-size: 11px; white-space: nowrap; }
.stay-detail .rooms-head__note>text:first-child { max-width: none; margin-right: 2px; white-space: nowrap; }
.stay-detail .rooms-head__edit { margin-left: 2px; color: var(--k-red-deep); font-weight: 500; }

.stay-detail .room-section .rooms-state, .stay-detail .room-section .list-empty { border-radius: 12px; background: var(--k-paper); }
/* 房型卡：左边 96 的方图，右边名字 / 规格 / 评价 / 价格，右下角 28 高的「选择」；选中的那张描一圈暖棕细边 */
.stay-detail .room-stack { gap: 8px; padding: 0; }
.stay-detail .rt { flex-direction: row; align-items: flex-start; gap: 10px; margin: 0; padding: 10px; border: 0; border-radius: 12px; background: var(--k-paper); box-shadow: none; overflow: visible; }
.stay-detail .rt.on { box-shadow: inset 0 0 0 1.5px var(--k-red); }
.stay-detail .rt__pic { flex: 0 0 96px; width: 96px; height: 96px; padding-bottom: 0; border-radius: 8px; background: var(--k-paper2); }
.stay-detail .rt__body { flex: 1; min-width: 0; padding: 0; }
.stay-detail .rt__name { color: var(--k-ink); font-family: var(--k-sans); font-size: 14px; font-weight: 600; line-height: 20px; }
.stay-detail .rt__line { margin: 2px 0 0; color: var(--k-muted); font-size: 11px; font-weight: 400; line-height: 16px; }
.stay-detail .rt__review { min-height: 28px; margin: 2px 0 0; gap: 6px; }

.stay-detail .rt__score { color: var(--k-red-deep); font-size: 12px; font-weight: 600; }
.stay-detail .rt__review .rt__cnt, .stay-detail .rt__none { margin-left: 2px; color: var(--k-muted); font-size: 11px; }
.stay-detail .rt__review-go { gap: 0; color: var(--k-red-deep); font-size: 11px; }

.stay-detail .rt__foot { flex-wrap: nowrap; align-items: flex-end; gap: 8px; margin-top: 4px; padding-top: 0; border: 0; }
.stay-detail .rt__left { flex: 1; min-width: 0; align-items: center; gap: 2px 6px; }
.stay-detail .rt__price { align-items: baseline; }
.stay-detail .rt__yen { color: var(--k-red-deep); font-size: 11px; font-weight: 600; }
.stay-detail .rt__num { color: var(--k-red-deep); font-family: var(--k-sans); font-size: 18px; font-weight: 700; line-height: 24px; letter-spacing: 0; }
.stay-detail .rt__unit { margin-left: 3px; color: var(--k-muted); font-size: 11px; }
.stay-detail .rt__left .stay-period-options { flex: 0 0 100%; order: 3; margin: 0; }
.stay-detail .rt__few { height: 17px; padding: 0 5px; border-radius: 4px; background: var(--k-alert-soft); color: var(--k-alert); font-size: 10px; font-weight: 500; line-height: 17px; }
.stay-detail .rt__few--ok { display: block; background: var(--k-green-soft); color: var(--k-green); }
.stay-detail .rt__few--off { height: auto; min-height: 17px; background: var(--k-fill); color: var(--k-muted); font-weight: 400; white-space: normal; }
.stay-detail .rt__btn { min-width: 56px; height: 28px; padding: 0 12px; border: 1px solid var(--k-red-line); border-radius: 14px; background: var(--k-paper); color: var(--k-red-deep); font-size: 12px; font-weight: 600; letter-spacing: 0; box-shadow: none; }
.stay-detail .rt__btn.on { border-color: transparent; background: linear-gradient(135deg,#B5814D,#8E5E33); color: var(--k-paper); }
.stay-detail .rt__btn.off { border-color: transparent; background: var(--k-fill); color: var(--k-light); }
.stay-detail .rt__play-dot { width: 28px; height: 28px; border: 0; background: rgba(20,14,10,.5); box-shadow: none; }

.stay-detail .rt__badge { left: 4px; top: auto; bottom: 4px; height: 16px; padding: 0 5px; border-radius: 8px; background: rgba(20,14,10,.5); font-size: 10px; font-weight: 500; line-height: 16px; }
.stay-detail .room__promo { left: 12px; top: 12px; height: 17px; padding: 0 5px; border-radius: 4px; background: rgba(255,255,255,.94); color: var(--k-ochre-deep); font-size: 10px; font-weight: 500; line-height: 17px; }
.stay-detail .rt .room__promo { left: 4px; right: auto; top: 4px; bottom: auto; height: 17px; font-size: 10px; line-height: 17px; }
/* —— 底部预订条：白底细线，右边 42 高的暖棕胶囊钮 —— */
.stay-detail .stay-booking-dock { left: 0; right: 0; bottom: 0; padding: 8px 12px calc(8px + env(safe-area-inset-bottom) * .5); background: var(--k-paper); box-shadow: 0 -.5px 0 rgba(20,14,10,.08); }
.stay-detail .pickbar { min-height: 44px; padding: 0; gap: 10px; border-radius: 0; background: transparent; box-shadow: none; }
.stay-detail .picked { gap: 0; }
.stay-detail .picked__from { color: var(--k-red-deep); font-family: var(--k-sans); font-size: 17px; font-weight: 700; line-height: 24px; }
.stay-detail .picked--pending .picked__from { color: var(--k-ink); font-size: 14px; font-weight: 600; line-height: 20px; }
.stay-detail .picked__hint, .stay-detail .picked--pending .picked__hint { margin-top: 0; color: var(--k-muted); font-size: 11px; line-height: 16px; }
.stay-detail .picked__text { color: var(--k-ink); font-size: 12px; font-weight: 500; line-height: 17px; }
.stay-detail .picked__price { color: var(--k-red-deep); font-size: 12px; font-weight: 700; line-height: 17px; }
.stay-detail .book { min-width: 112px; height: 44px; padding: 0 22px; border-radius: 22px; background: linear-gradient(135deg,#B5814D,#8E5E33); box-shadow: none; }
.stay-detail .book__main { color: var(--k-paper); font-family: var(--k-sans); font-size: 15px; font-weight: 600; letter-spacing: 0; }
.stay-detail .book--disabled { opacity: .6; }
/* —— 第 2–4 屏（房型预览 / Vlog 列表 / Vlog 详情）同一套底色和白卡；设施图标放进 40 的小方块 —— */
.stay-detail .rooms-body, .stay-detail .vlogs-body { padding: 8px 12px calc(86px + var(--k-safe-bottom)); }
.stay-detail .facilities { height: auto; padding: 12px 4px; border-radius: 12px; background: var(--k-paper); justify-content: space-around; }
.stay-detail .facilities>view { width: 20%; gap: 6px; color: var(--k-ink2); font-size: 11px; line-height: 16px; }
.stay-detail .fac-tile { width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: 12px; background: linear-gradient(145deg,#FCF4E8,#F4E4CC); }
.stay-detail .card { border: 0; border-radius: 12px; background: var(--k-paper); }
.stay-detail .host { margin-top: 8px; padding: 12px; }
.stay-detail .host-title { font-family: var(--k-sans); font-size: 15px; font-weight: 700; }
.stay-detail .host-main { margin-top: 10px; }
.stay-detail .host-main>image { width: 44px; height: 44px; }
.stay-detail .host-main>view { margin-left: 10px; }
.stay-detail .host-main>view>text { color: var(--k-ink2); font-size: 13px; line-height: 20px; }
.stay-detail .host-main>view>view { margin-top: 6px; color: var(--k-red-deep); font-size: 12px; font-weight: 500; }
.stay-detail .host-stats { height: auto; margin-top: 10px; padding-top: 10px; align-items: center; color: var(--k-ink2); font-size: 12px; font-weight: 500; }
.stay-detail .section-head { height: 44px; }
.stay-detail .section-head>text { font-family: var(--k-sans); font-size: 16px; font-weight: 700; }
.stay-detail .section-head>view { font-size: 12px; }
.stay-detail .room-list { gap: 8px; }
.stay-detail .room { height: auto; min-height: 112px; padding: 8px; }
.stay-detail .room>image { width: 96px; height: 96px; border-radius: 8px; }
.stay-detail .room>view { padding: 2px 0 0 10px; }
.stay-detail .room>view>text:first-child { font-family: var(--k-sans); font-size: 14px; font-weight: 600; line-height: 20px; }
.stay-detail .room>view>text:nth-child(2) { margin-top: 4px; font-size: 11px; line-height: 16px; }
.stay-detail .room>view>view { margin-top: 12px; }
.stay-detail .room>view>view text:first-child { color: var(--k-red-deep); font: 700 18px var(--k-sans); }
.stay-detail .room>view>view text:last-child { margin-left: 3px; }
.stay-detail .vlog-list { gap: 8px; }
.stay-detail .vlog { height: auto; min-height: 112px; padding: 8px; border-radius: 12px; background: var(--k-paper); }
.stay-detail .vlog>image { width: 128px; height: 96px; border-radius: 8px; }
.stay-detail .vlog>view { padding: 2px 0 2px 10px; }
.stay-detail .vlog__title { margin-bottom: 4px; font-family: var(--k-sans); font-size: 14px; font-weight: 600; line-height: 20px; }

.stay-detail .review-head { margin-top: 8px; border-top: 0; }
.stay-detail .review-head>text>text { font-size: 12px; }
.stay-detail .guest-review>image { width: 36px; height: 36px; }
.stay-detail .guest-review>view text:first-child { font-family: var(--k-sans); font-size: 14px; font-weight: 600; }
.stay-detail .guest-review>text { color: var(--k-red-deep); font: 700 16px var(--k-sans); }
.stay-detail .guest-copy { margin-top: 8px; color: var(--k-ink2); font-size: 13px; line-height: 20px; }
.stay-detail .vlog-copy { padding: 12px; background: var(--k-paper); }
.stay-detail .vlog-detail__title { font-family: var(--k-sans); font-size: 17px; font-weight: 700; line-height: 24px; }
.stay-detail .author { margin-top: 10px; }
.stay-detail .author>image { width: 36px; height: 36px; }
.stay-detail .author>view>view { font-size: 14px; font-weight: 600; }
.stay-detail .vlog-desc, .stay-detail .vlog-source { margin-top: 10px; font-size: 13px; line-height: 20px; }
.stay-detail .vlog-source { font-size: 11px; }
.stay-detail .vlog-comment { min-height: 44px; margin-top: 10px; padding: 0 8px 0 12px; border: 0; border-radius: 8px; background: var(--k-page); font-size: 13px; }
.stay-detail .vlog-review-link { height: 48px; margin-top: 8px; padding: 0 12px; gap: 8px; border: 0; background: var(--k-paper); }
.stay-detail .vlog-review-link>text { font-family: var(--k-sans); font-size: 15px; font-weight: 700; }
.stay-detail .vlog-review-link>view { font-size: 12px; }
/* 2026-11-18 看图复查：
   · 右边贴着屏幕的「客服」小钮宽 28，会压住地址行的「复制地址」和主理人卡的「关注」—— 这两处往左让开；
   · 收藏 / 分享在照片上已经有一对（主入口），标题行这一对收小成 18 的灰色小图标，图标也统一用心形；
   · 第 3 屏的住客评价放进白卡，评分前面带一颗小星；「暂无Vlog」「暂无可订房型」也垫一张白卡；
   · 第 2 屏房型卡右边留到 12，和左、上对齐；「查看服务」后面的箭头换成小图标。 */
.stay-detail .location { padding-right: 24px; }
.stay-detail .host2__follow { margin-right: 8px; }
.stay-detail .title-actions .stay-share-icon { width: 18px !important; height: 18px !important; }
.stay-detail .title-actions .stay-share-icon { filter: grayscale(1); opacity: .7; }
.stay-detail .sec-go { flex: 0 0 auto; display: flex; align-items: center; gap: 1px; color: var(--k-muted); font-size: 12px; line-height: 18px; }
.stay-detail .rooms-body .list-empty, .stay-detail .vlogs-body .list-empty { padding: 20px 12px; border-radius: 12px; background: var(--k-paper); font-size: 12px; line-height: 18px; }
.stay-detail .guest-card { padding: 12px; border-radius: 12px; background: var(--k-paper); }
.stay-detail .guest-review>view text:last-child { line-height: 16px; }
.stay-detail .guest-review>text { display: flex; align-items: center; gap: 3px; font: 600 13px var(--k-sans); line-height: 18px; }
.stay-detail .guest-card .guest-copy { margin-top: 0; overflow-wrap: anywhere; }
.stay-detail .guest-card .guest-review + .guest-copy { margin-top: 8px; }
.stay-detail .room>view { padding: 2px 4px 0 10px; }
/* 2026-11-18 第二轮精修：
   · 卡片标题统一 16 / 700（原来多数 15、房型区 16）；
   · 「7晚参考价起」旁的房型数、地址卡「复制地址」、「关注」主理人三种小钮统一 28 高、圆角 14、12 / 500，四周多 4px 透明可点范围；
   · 评价 / 旅居日记 / Vlog 三个入口方块统一成同一块浅暖底 + 深棕线稿；房型卡和第 3 屏住客评价的星星统一赭黄 var(--k-ochre)；
   · 箭头统一 12 号（去掉原来的强制缩放）；第 2 屏主理人卡的来源标签改浅棕底深棕字；
   · 底部「订房」44 高、圆角 22，不可点时整体变淡 .6（和公共按钮的实心钮一致，按钮上的字还读得清）；房型价格 ¥ 12、数字等宽，「选择」钮字重 500；地址卡上的分隔改发丝线；第 4 屏「已关注」收成 28 高小钮。 */
.stay-detail .sec-title, .stay-detail .vcard__title .sec-title, .stay-detail .acts__head .sec-title { font-size: 16px; line-height: 22px; }
.stay-detail .info-price__pill, .stay-detail .location-action, .stay-detail .host2__follow { position: relative; height: 28px; min-height: 28px; padding: 0 12px; border-radius: 14px; font-size: 12px; font-weight: 500; }
.stay-detail .info-price__pill::after, .stay-detail .location-action::after, .stay-detail .host2__follow::after { content: ''; position: absolute; left: -4px; right: -4px; top: -4px; bottom: -4px; }
.stay-detail .host-title :deep(.k-chip) { height: 17px; padding: 0 5px; border-radius: 4px; background: var(--k-red-soft); color: var(--k-red-deep); font-size: 10px; font-weight: 500; }
.stay-detail .rt__yen { font-size: 12px; }
.stay-detail .rt__num { font-variant-numeric: tabular-nums; }
.stay-detail .rt__btn { font-weight: 500; }
.stay-detail .location { position: relative; border-top: 0; }
.stay-detail .location::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); }
/* 复查：Vlog 详情的「关注」看上去 28 高，四周 4px 透明边把可点范围撑到 36（负边距抵掉，位置不变）；细棕边改由内阴影画 */
.stay-detail .author :deep(.k-button) { height: 36px; margin: -4px -4px -4px 0; padding: 0 12px; border: 4px solid transparent; border-radius: 18px; background-clip: padding-box; box-shadow: inset 0 0 0 1px var(--k-red-line); color: var(--k-red-deep); font-size: 12px; font-weight: 500; }
@media (max-width: 359px) {
  .stay-detail .title-row>view:first-child>view:first-child>text { font-size: 17px; line-height: 24px; }
  .stay-detail .info-price__num { font-size: 20px; }
  .stay-detail .location-main { font-size: 12px; }
  /* 两张入口卡并排只有一百四十来像素宽：小图标方块收到 24（复查：之前窄屏直接不显示），标题 13 号字，七个字正好完整显示 */
  .stay-detail .entry__title, .stay-detail .entry.entry--reviews .entry__title { padding-left: 30px; font-size: 13px; line-height: 24px; }
  .stay-detail .rooms-head__note { margin-left: 0; white-space: normal; flex-wrap: wrap; }
  .stay-detail .rt { gap: 8px; }
  .stay-detail .rt__pic { flex-basis: 80px; width: 80px; height: 80px; }
  .stay-detail .rt__body { padding: 0; }
  .stay-detail .rt__num { font-size: 17px; }
  .stay-detail .rt__btn { min-width: 48px; padding: 0 10px; }
  .stay-detail .book { min-width: 96px; padding: 0 16px; }
}
/* 2026-11-18 第三轮逐页精修（比例 / 间距 / 图标）：
   · 头图上的收藏 / 分享拆成两颗和返回钮同款的 32 白色圆钮，图标 16 墨色，去掉中间竖线；
   · 价格区：¥ 数字下面先空 8 再放「入住日 / 半月 / 一个月」浅暖底小方块，说明另起一段 11 号浅灰；
   · 区块之间 12、区块标题 16 / 700 一个样；入口卡左上的小图标从 CSS 背景图换成 k-icon（40 方块、浅棕底、18 号线稿）；
   · 主理人：年龄 / 籍贯 / 擅长 拆成「12 暖灰标签 + 13 正文」两列；累计接待 / 评价两格居中、中间一条发丝竖线；
   · 空状态（暂无可订房型 / 暂无 Vlog）：56 浅棕方块 + 32 号图标；「小院故事」箭头换图标。 */
.stay-detail .hero-actions { right: 12px; height: 32px; gap: 8px; padding: 0; border-radius: 0; background: transparent; }
.stay-detail .hero-action { width: 32px; height: 32px; border-radius: 16px; background: var(--sd-veil); display: flex; align-items: center; justify-content: center; }
.stay-detail .hero-action .stay-share-icon { width: 16px !important; height: 16px !important; }
.stay-detail .hero-action .stay-share-icon { filter: brightness(0); opacity: .72; }
.stay-detail .hero-actions__line { display: none; }
.stay-detail .hero-count { right: 12px; bottom: 26px; height: 20px; padding: 0 8px; border-radius: 10px; background: var(--sd-shade); color: var(--k-paper); font-size: 11px; line-height: 20px; font-variant-numeric: tabular-nums; }
.stay-detail .info { padding: 16px 16px 12px; }
.stay-detail .title-row>view:first-child>view:first-child>text { font-size: 20px; line-height: 28px; }
.stay-detail .info-meta { margin-top: 8px; }
.stay-detail .info-meta__copy .rating { margin-top: 6px; }
.stay-detail .info-price { margin-top: 4px; }
.stay-detail .info-price__num { font-size: 24px; line-height: 30px; color: var(--k-red); font-variant-numeric: tabular-nums; }
.stay-detail .info-price__unit { margin-left: 6px; font-size: 12px; }
.stay-detail .info .stay-period-options { margin: 8px 0 0; padding: 8px 10px; border-radius: 8px; background: var(--k-hair); color: var(--k-ink2); font-size: 12px; line-height: 18px; font-variant-numeric: tabular-nums; }
.stay-detail .week-price-note { margin: 8px 0 0; color: var(--k-light); font-size: 11px; line-height: 16px; }
.stay-detail .info-promo { margin-top: 8px; }
.stay-detail .location { margin-top: 12px; padding-top: 12px; }
.stay-detail .overview-body { padding: 0 12px 16px; }
.stay-detail .slogan, .stay-detail .sec-card, .stay-detail .acts, .stay-detail .room-section { margin-top: 12px; }
.stay-detail .sec-card, .stay-detail .host2 { padding: 14px 12px; }
.stay-detail .trip .sec-head { margin-bottom: 4px; }
.stay-detail .trip__row { margin-top: 8px; }
/* 主理人 */
.stay-detail .host2__main { gap: 12px; margin-top: 12px; }
.stay-detail .host2__avatar { width: 48px; height: 48px; border-radius: 24px; }
.stay-detail .host2__copy { gap: 4px; }
.stay-detail .host2__name { font-size: 15px; line-height: 21px; }
.stay-detail .host2__facts { display: flex; flex-direction: column; gap: 2px; margin-top: 2px; }
.stay-detail .host2__fact, .stay-detail .host2__fact--wide { display: block; color: var(--k-ink2); font-size: 13px; line-height: 20px; }
.stay-detail .host2__scores { margin-top: 4px; }
.stay-detail .host2__intro { margin-top: 4px; }
.stay-detail .host2__story { margin-top: 12px; padding: 10px 12px; }
.stay-detail .host2__more { display: flex; align-items: center; gap: 2px; margin-top: 6px; color: var(--k-red-deep); font-size: 12px; font-weight: 500; }
.stay-detail .host-stats { position: relative; display: flex; justify-content: space-around; align-items: center; height: 40px; margin-top: 12px; padding-top: 12px; border-top: 0; color: var(--k-ink2); font-size: 12px; font-weight: 500; font-variant-numeric: tabular-nums; }
.stay-detail .host-stats::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); }
.stay-detail .host-stats::after { content: ''; position: absolute; left: 50%; top: 22px; width: 1px; height: 20px; background: var(--k-line2); transform: scaleX(.5); }
.stay-detail .host-stats>text { flex: 1 1 0; text-align: center; }
/* 评价 / 日记 / Vlog 入口：左上 40 小方块（k-icon），标题在方块右边垂直居中 */
.stay-detail .entry::before, .stay-detail .entry--reviews::before, .stay-detail .entry--diary::before { content: none; display: none; }
.stay-detail .entry, .stay-detail .entry.entry--reviews { padding: 12px; }
.stay-detail .entry__ic { position: absolute; left: 12px; top: 12px; width: 36px; height: 36px; border-radius: 10px; background: var(--k-red-soft); display: flex; align-items: center; justify-content: center; }
.stay-detail .entry__title, .stay-detail .entry.entry--reviews .entry__title { padding-left: 44px; line-height: 36px; }
.stay-detail .entry__sub { margin-top: 8px; font-size: 12px; line-height: 18px; }
.stay-detail .entry--reviews .entry__score { margin-top: 8px; }
/* 房型区 */
.stay-detail .rooms-head { margin: 24px 0 10px; }
.stay-detail .rt { padding: 12px; gap: 12px; }
.stay-detail .rt__left .stay-period-options { margin-top: 4px; padding: 5px 8px; border-radius: 8px; background: var(--k-hair); color: var(--k-ink2); font-size: 11px; line-height: 16px; }
/* 空状态 */
.stay-detail .r3-empty { display: flex; flex-direction: column; align-items: center; gap: 4px; margin: 0; padding: 28px 16px; border-radius: 12px; background: var(--k-paper); color: var(--k-ink2); font-size: 14px; font-weight: 500; line-height: 1.5; text-align: center; }
.stay-detail .r3-empty-ic { width: 56px; height: 56px; margin-bottom: 6px; border-radius: 16px; background: var(--k-red-soft); display: flex; align-items: center; justify-content: center; }
/* 第 2 屏房型卡：没描述时价格跟在标题下面，不再空一大块 */
.stay-detail .room { min-height: 0; padding: 12px; }
.stay-detail .room>view { display: flex; flex-direction: column; justify-content: flex-start; }
.stay-detail .room>view>view { margin-top: 8px; }
.stay-detail .room>view>text:nth-child(2):empty { display: none; }
.stay-detail .facilities>view { gap: 8px; }
@media (max-width: 359px) {
  .stay-detail .info { padding: 14px 12px 12px; }
  .stay-detail .title-row>view:first-child>view:first-child>text { font-size: 18px; line-height: 26px; }
  .stay-detail .info-price__num { font-size: 22px; }
  .stay-detail .entry__ic { width: 28px; height: 28px; border-radius: 8px; }
  .stay-detail .entry__title, .stay-detail .entry.entry--reviews .entry__title { padding-left: 34px; line-height: 28px; }
}
/* 第三轮复查：房型卡里的半月 / 一个月价不再垫底色（一屏六张卡都垫一块显得重），11 号暖灰跟在价格下面；第 2 屏房型预览的价格靠左跟在标题下 */
.stay-detail .rt__left .stay-period-options { margin-top: 2px; padding: 0; border-radius: 0; background: transparent; color: var(--k-muted); }
.stay-detail .room>view>view { text-align: left; }
@media (max-width: 359px) {
  /* 320 宽两张入口卡并排只有一百四十来像素：小图标方块 24、卡内 10，「住过的家人评价」七个字完整显示 */
  .stay-detail .entry, .stay-detail .entry.entry--reviews { padding: 10px; }
  .stay-detail .entry__ic { left: 10px; top: 10px; width: 24px; height: 24px; border-radius: 8px; }

  .stay-detail .entry__title, .stay-detail .entry.entry--reviews .entry__title { padding-left: 30px; font-size: 13px; line-height: 24px; }
}
/* 2026-11-18 第三轮返修（独立评审第 1 轮）：
   · 信息区左右 24，和下面白卡里的内容同一条线；「N种房型可选」「复制地址」两颗胶囊右边对齐；
   · 周期价不垫浅暖底，12 号暖灰；标签 11 号高 20；分享两处都换成 k-icon（share-2）；
   · 小图标统一到档位 12（3分钟看小院圆点、房型评分星、查看评价、改日期）；
   · 「小院活动」只有往期时做成一行入口：36 浅棕方块 + 日历图标 + 一句说明 + 右箭头；
   · 设施方块纯浅棕底、图标 22；房型预览卡价格贴底；主理人标签 11 号；
   · 空状态（暂无 Vlog / 暂无可订房型）放在页面底上：56 方块 + 32 号图标 + 说明；
   · 住客评价分数前的星换成 k-icon；Vlog 没封面时 16:9 浅棕占位 + 40 号视频图标；最后一条不再带向下箭头。 */
.stay-detail .info { padding-left: 24px; padding-right: 24px; }
.stay-detail .location { padding-right: 0; }
.stay-detail .info-price__pill, .stay-detail .location-action { margin-right: 0; }
.stay-detail .info .stay-period-options { align-self: flex-start; margin: 6px 0 0; padding: 0; border-radius: 0; background: transparent; color: var(--k-muted); font-size: 12px; line-height: 18px; }
.stay-detail .ichip { height: 20px; padding: 0 6px; font-size: 11px; line-height: 20px; }



/* 小院活动入口行 */
.stay-detail .acts__title { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.stay-detail .acts--entry { padding: 12px; }
.stay-detail .acts--entry .acts__head { justify-content: flex-start; gap: 12px; margin: 0; }
.stay-detail .acts__ic { flex: 0 0 36px; width: 36px; height: 36px; border-radius: 10px; background: var(--k-red-soft); display: flex; align-items: center; justify-content: center; }
.stay-detail .acts__desc { color: var(--k-muted); font-size: 12px; font-weight: 400; line-height: 17px; }
.stay-detail .acts--entry .acts__toggle { flex: 0 0 auto; color: var(--k-muted); font-size: 12px; }
/* 房型区空状态（不垫白卡） */
.stay-detail .rooms-empty-ic { margin: 16px auto 8px; }
.stay-detail .rooms-head ~ .list-empty { display: block; margin: 0; padding: 0; background: transparent; color: var(--k-ink2); font-size: 14px; font-weight: 500; line-height: 20px; text-align: center; }
.stay-detail .rooms-empty-sub { display: block; margin: 4px 0 16px; color: var(--k-muted); font-size: 12px; line-height: 18px; text-align: center; }
/* 设施方块：纯色 */
.stay-detail .fac-tile { background: var(--k-red-soft); }

.stay-detail .room>view>view { margin-top: auto; padding-top: 8px; }
.stay-detail .host-title :deep(.k-chip), .stay-detail .host-title :deep(.k-chip text) { font-size: 11px; }
/* 第 3 屏：近期 Vlog 空 + 住客评价 */
.stay-detail .r3-empty--page { margin: 8px 0 12px; padding: 24px 16px; background: transparent; }
.stay-detail .r3-empty--page .list-empty { margin: 0; padding: 0; background: transparent; color: var(--k-ink2); font-size: 14px; font-weight: 500; line-height: 20px; }
.stay-detail .r3-empty__sub { color: var(--k-muted); font-size: 12px; font-weight: 400; line-height: 18px; }
.stay-detail .guest-review>text::before { content: none; display: none; }
.stay-detail .guest-review__star { margin-left: auto; display: flex; align-items: center; }
.stay-detail .guest-review>text { margin-left: 4px; }
/* 第 4 屏：Vlog 详情 */
.stay-detail .vlog-detail { position: relative; }
.stay-detail .vlog-video--empty { height: 220px; opacity: 0; }
.stay-detail .vlog-video-ph { position: absolute; left: 0; right: 0; top: 0; height: 220px; background: var(--k-red-soft); display: flex; align-items: center; justify-content: center; pointer-events: none; }
.stay-detail .vlog-review-link > :deep(.k-icon), .stay-detail .vlog-review-link > k-icon { display: none; }
.stay-detail .swipe-next--end :deep(.k-icon) { display: none; }
.stay-detail .swipe-next--end { color: var(--k-muted); font-size: 12px; justify-content: center; }
@media (max-width: 359px) {
  .stay-detail .picked__hint { display: block; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-size: 11px; }
  .stay-detail .book { flex: 0 0 128px; width: 128px; min-width: 0; padding: 0; }
  .stay-detail .week-price-note { font-size: 11px; }
  .stay-detail .rt__review { flex-wrap: wrap; row-gap: 2px; }
  .stay-detail .rt__review .rt__rate { flex: 1 1 100%; flex-wrap: nowrap; }
  .stay-detail .rt__review-go { margin-left: auto; }
}
/* 11-18 第三轮返修（独立评审第 2 轮）：
   · 评价 / 生活碎片 / Vlog / 小院活动几个入口同一个样子：整行白卡，左 36 浅棕方块 + 18 号图标，标题 15 / 600、说明 12 灰，右边箭头（评价分数放在箭头前）；
   · 不同内容区之间 20，同一组（入口之间）8；名字右边的收藏 / 分享和头图一样做成 32 圆钮（文字仍在，只是不占位）；
   · 主理人：累计接待数字 18 / 700 等宽在上、「累计接待」12 灰在下，没有评价那格 13 灰；评分小标签 11 号高 20；房型名 15 / 600；
   · 房型预览卡价格紧跟标题；Vlog 详情作者区、评价入口改成左右 12 的圆角白卡；小屏底部条说明、价格说明不剩一两个字单独一行。 */
.stay-detail .slogan, .stay-detail .sec-card, .stay-detail .room-section { margin-top: 20px; }
.stay-detail .room-section .acts { margin-top: 8px; }
.stay-detail .entries { display: flex; flex-direction: column; gap: 8px; margin: 0; }
.stay-detail .entries .entry, .stay-detail .entries .entry.entry--reviews { position: relative; display: flex; flex-direction: row; align-items: center; gap: 12px; min-height: 64px; height: auto; padding: 12px; border-radius: 12px; background: var(--k-paper); }
.stay-detail .entries .entry__ic { position: static; order: -1; flex: 0 0 36px; width: 36px; height: 36px; border-radius: 10px; }

.stay-detail .entries .entry__copy { order: 0; flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.stay-detail .entries .entry__title, .stay-detail .entries .entry.entry--reviews .entry__title { padding-left: 0; color: var(--k-ink); font-size: 15px; font-weight: 600; line-height: 21px; letter-spacing: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.stay-detail .entries .entry__sub { margin-top: 0; color: var(--k-muted); font-size: 12px; line-height: 18px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.stay-detail .entries .entry--reviews .entry__score { order: 1; flex: 0 0 auto; margin: 0; min-height: 0; padding: 0; display: flex; flex-direction: row; align-items: baseline; gap: 4px; background: transparent; }
.stay-detail .entries .entry--reviews .entry__num { color: var(--k-red-deep); font-size: 15px; font-weight: 600; line-height: 21px; font-variant-numeric: tabular-nums; }
.stay-detail .entries .entry > .k-icon { display: flex; order: 2; flex: 0 0 auto; width: 16px !important; height: 16px !important; }
.stay-detail .acts--entry { min-height: 64px; padding: 12px; }
.stay-detail .acts--entry .sec-title { font-size: 15px; font-weight: 600; line-height: 21px; }
.stay-detail .acts--entry .acts__desc { font-size: 12px; line-height: 18px; }
.stay-detail .title-actions { gap: 8px; }
.stay-detail .title-actions>view { position: relative; width: 32px; height: 32px; padding: 0; border-radius: 16px; background: var(--k-paper2); display: flex; align-items: center; justify-content: center; overflow: hidden; }
.stay-detail .title-actions>view>text { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

.stay-detail .host-stats { height: auto; padding: 12px 0 0; align-items: center; }
.stay-detail .host-stats::after { top: 50%; margin-top: 6px; transform: translateY(-50%) scaleX(.5); }
.stay-detail .host-stat { flex: 1 1 0; display: flex; flex-direction: column; align-items: center; gap: 2px; }
.stay-detail .host-stat__num { color: var(--k-ink); font-size: 18px; font-weight: 700; line-height: 24px; font-variant-numeric: tabular-nums; }
.stay-detail .host-stat__label { color: var(--k-muted); font-size: 12px; font-weight: 400; line-height: 18px; }
.stay-detail .host-stats>text.host-stat__rate { flex: 1 1 0; color: var(--k-muted); font-size: 13px; font-weight: 400; line-height: 20px; text-align: center; }
.stay-detail .host2__score { height: 20px; padding: 0 6px; font-size: 11px; line-height: 20px; }
.stay-detail .rt__name { font-size: 15px; font-weight: 600; line-height: 21px; }
.stay-detail .room>view { justify-content: flex-start; }
.stay-detail .room>view>view { margin-top: 4px; padding-top: 0; }
.stay-detail .vlog-copy { margin: 12px 12px 0; padding: 12px; border-radius: 12px; background: var(--k-paper); }
.stay-detail .vlog-review-link { margin: 12px 12px 0; padding: 0 12px; border-radius: 12px; background: var(--k-paper); }
.stay-detail .swipe-next { margin-top: 20px; }
@media (max-width: 359px) {
  .stay-detail .entries .entry, .stay-detail .entries .entry.entry--reviews { padding: 12px; }
  .stay-detail .entries .entry__ic { width: 36px; height: 36px; border-radius: 10px; }

  .stay-detail .entries .entry__title, .stay-detail .entries .entry.entry--reviews .entry__title { padding-left: 0; font-size: 15px; line-height: 21px; }
  .stay-detail .week-price-note { display: block; max-width: 230px; }
  .stay-detail .host2__facts { word-break: keep-all; }
}
/* 11-18 第三轮返修（独立评审第 3 轮）：
   · 第一屏只留一套收藏 / 分享（名称右边那两颗），头图上的白圆钮不再出现；
   · 价格区：¥ 大字 → 两档周期价「·」并成一行 12 墨灰 → 价格说明 11 浅灰；入住日不再重复；
   · 评价 / 生活碎片 / Vlog 入口合成一张列表卡（行高 64、发丝线分隔）；区块标题前的实心播放点去掉；
   · 房型卡：周期价不重复入住日，图 96×96 和文字块垂直居中；房型预览卡价格贴底；
   · 主理人卡「年龄 · …」悬挂缩进，折行和内容对齐；小标签 11/500 高 20，亮点标签不折行（可横滑）；
   · Vlog 详情无封面：和深色顶栏连成一块的暖深渐变 + 32 白色线性图标；评论行去掉灰底改发丝线；评价入口做成入口行。 */
.stay-detail {
  --sd-veil: rgba(255, 255, 255, .92);
  --sd-night: #151311;
  --sd-shade: rgba(20,14,10,.42);
}
.stay-detail .hero-actions { display: none; }
.stay-detail .info-price__num { font-size: 28px; line-height: 34px; }
.stay-detail .stay-period-options { margin-top: 4px; color: var(--k-ink2); font-size: 12px; line-height: 18px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.stay-detail .week-price-note { margin-top: 4px; color: var(--k-light); font-size: 11px; line-height: 16px; }
.stay-detail .vcard__dot { display: none; }
.stay-detail .entries { gap: 0; border-radius: 12px; background: var(--k-paper); overflow: hidden; }
.stay-detail .entries .entry, .stay-detail .entries .entry.entry--reviews { border-radius: 0; background: transparent; }
.stay-detail .entries .entry + .entry::after { content: ''; display: block; position: absolute; left: 60px; right: 12px; top: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); }
.stay-detail .rt { align-items: center; }
.stay-detail .rt__pic, .stay-detail .rt__img { width: 96px; height: 96px; }
.stay-detail .rt .stay-period-options { white-space: pre-line; overflow: visible; color: var(--k-muted); font-size: 11px; line-height: 16px; }
.stay-detail .room>view { display: flex; flex-direction: column; justify-content: space-between; }
.stay-detail .ichip, .stay-detail .trip__k { height: 20px; padding: 0 6px; font-size: 11px; font-weight: 500; line-height: 20px; }
.stay-detail .info-chips { flex-wrap: nowrap; overflow-x: auto; overflow-y: hidden; scrollbar-width: none; }
.stay-detail .info-chips::-webkit-scrollbar { display: none; }
.stay-detail .info-chips .ichip { flex: 0 0 auto; white-space: nowrap; }
.stay-detail .host2__fact, .stay-detail .host2__facts .host2__fact { display: block; padding-left: 44px; text-indent: -44px; word-break: break-all; }
.stay-detail .vlog-video-ph { background: linear-gradient(180deg, var(--sd-night) 0%, var(--k-red-deep) 100%); }
.stay-detail .vlog-comment { margin-top: 12px; padding: 0; border-radius: 0; background: transparent; position: relative; }
.stay-detail .vlog-comment::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); }
.stay-detail .vlog-review-link { height: 56px; }
.stay-detail .vlog-review-link>text { font-size: 15px; font-weight: 600; }
.stay-detail .r3-empty--page { margin: 12px 12px 0; padding: 24px; border-radius: 12px; background: var(--k-paper); }
/* 11-18 第四轮返修：Vlog 空状态白卡和下面的评价卡同宽（父层已有 12 边距）；名称行分享钮右边线和卡里「复制地址」对齐。 */
.stay-detail .r3-empty--page { margin: 12px 0 0; }
.stay-detail .info .title-actions { margin-right: 0; }
/* 11-18 第五轮返修（功能补回 + 评审第 5 轮）：
   · 周期价恢复原文（含入住日那一行），按行显示；Vlog 作者名为空时不再写「当地主理人」，名字那格收起；
   · 标语卡：右侧印章缩到 52，375 宽标语一行放下（不剩「家」字单独一行）；
   · 320 宽：底栏说明允许两行不截断；亮点标签折行（最多两行），不藏在屏外；
   · 房型预览卡：名称 / 描述 / 价格整体垂直居中、间距 8，没有描述时不再中间空一块；
   · 主理人统计：右格文字和左格数字同一行高，左右成对；
   · Vlog 无封面占位：浅暖底 + 40 号灰色线性图标，不再是深棕渐变。 */
.stay-detail .stay-period-options { white-space: pre-line; overflow: visible; }
.stay-detail .author text.is-empty { display: none; }
.stay-detail .slogan image { width: 52px; height: 40px; box-shadow: none; }
.stay-detail .room>view { justify-content: center; gap: 8px; }
.stay-detail .room>view>text:nth-child(2), .stay-detail .room>view>view { margin-top: 0; padding-top: 0; }
.stay-detail .host-stats { align-items: flex-start; }
.stay-detail .host-stats>text.host-stat__rate { line-height: 24px; }
.stay-detail .vlog-video-ph { background: var(--k-red-soft); }
@media (max-width: 389px) {
  .stay-detail .slogan>view text:first-child { font-size: 14px; line-height: 20px; }
}
@media (max-width: 359px) {
  .stay-detail .info-chips { flex-wrap: wrap; row-gap: 6px; max-height: 46px; overflow: hidden; }
}
/* <<R6-BEGIN>> */
/* 11-18 第四轮（按微信实拍评审）：
   · 头图上的收藏 / 分享白圆钮恢复显示；名称右边两颗改 36 圆形 --k-fill 图标钮；
   · 标签行：「袋鼠直营」描边、「安心住」绿底，设施改纯文字 + 发丝竖线，可以换行（不再横滑藏在屏外）；
   · 「N种房型可选」改文字链 + 箭头；周期价 12/18 muted，说明 11 和周期价隔 8；地址行右边让开客服竖条；
   · 首屏以下改通栏白底：区块之间发丝线 + 上下 20，不再灰底上摆白卡；标语卡浅棕底；
   · 主理人标题和其它区块同级 16/700，「已关注」灰底灰字；统计右格上下居中；出行参考小标签和正文首行居中；
   · 房型预览：一张列表，80 方图，没有描述时名称和价格紧挨；Vlog 空态压成小号；
   · Vlog 详情：深色 16:9 封面占位和深色顶栏连成一块，下面接圆角白 sheet（作者行 + 审核状态 → 评论 → 住客评价入口）。 */
.stay-detail .hero-actions { display: flex; right: 12px; height: 32px; gap: 0; padding: 0 2px; border-radius: 16px; background: var(--sd-veil); }
.stay-detail .hero-action { width: 36px; height: 32px; border-radius: 16px; background: transparent; }
.stay-detail .hero-actions__line { display: block; width: 1px; height: 14px; background: var(--k-line2); transform: scaleX(.5); }
.stay-detail .title-actions { gap: 8px; }
.stay-detail .title-actions>view { width: 36px; height: 36px; border-radius: 18px; background: var(--k-fill); }
.stay-detail .info-chips { flex-wrap: wrap; overflow: visible; max-height: none; row-gap: 6px; column-gap: 0; align-items: center; }
.stay-detail .info-chips .ichip { margin-right: 6px; }
.stay-detail .info-chips .ichip--src { background: transparent; box-shadow: inset 0 0 0 1px var(--k-red-line); color: var(--k-red-deep); }
.stay-detail .info-chips .ichip--plain { position: relative; height: 20px; margin: 0 12px 0 0; padding: 0; border-radius: 0; background: transparent; color: var(--k-ink2); font-size: 13px; font-weight: 400; line-height: 20px; }
.stay-detail .info-chips .ichip--src + .ichip--plain, .stay-detail .info-chips .ichip--safe + .ichip--plain { margin-left: 6px; }
.stay-detail .info-chips .ichip--plain + .ichip--plain::before { content: ''; position: absolute; left: -6px; top: 5px; bottom: 5px; width: 1px; background: var(--k-line2); transform: scaleX(.5); }
.stay-detail .info-price__pill.info-price__link { display: flex; align-items: center; gap: 2px; height: 28px; min-height: 28px; padding: 0; border: 0; border-radius: 0; background: transparent; box-shadow: none; color: var(--k-red-deep); font-size: 13px; font-weight: 500; }
.stay-detail .info .stay-period-options { margin-top: 4px; color: var(--k-muted); font-size: 12px; line-height: 18px; }
.stay-detail .info .week-price-note { margin-top: 8px; color: var(--k-light); font-size: 11px; line-height: 16px; }
.stay-detail .location { padding-right: 20px; }
.stay-detail .location-action { height: 28px; min-height: 28px; padding: 0 12px; border-radius: 14px; font-size: 12px; font-weight: 500; }
/* 通栏白底正文 */
.stay-detail .overview, .stay-detail .overview-body { background: var(--k-paper); }
.stay-detail .overview-body { padding: 0 24px 24px; }
.stay-detail .overview-body > .slogan { margin: 4px 0 20px; padding: 12px 16px; border-radius: 12px; background: var(--k-red-soft); }
.stay-detail .overview-body > .sec-card, .stay-detail .overview-body > .room-section { position: relative; margin: 0; padding: 20px 0; border: 0; border-radius: 0; background: transparent; box-shadow: none; }
.stay-detail .overview-body > .sec-card::before, .stay-detail .overview-body > .room-section::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); }
.stay-detail .sec-title, .stay-detail .host2 .sec-title, .stay-detail .acts__head .sec-title { color: var(--k-ink); font-size: 16px; font-weight: 700; line-height: 22px; }
.stay-detail .sec-head { margin-bottom: 12px; }
.stay-detail .vcard__dot { display: flex; width: 20px; height: 20px; margin-right: 6px; border-radius: 10px; background: var(--k-red); }
.stay-detail .trip__k { height: 20px; margin-top: 1px; line-height: 20px; }
.stay-detail .host2__follow.on { border-color: transparent; background: var(--k-fill); color: var(--k-muted); }
.stay-detail .host-stats { align-items: center; }
.stay-detail .host-stats>text.host-stat__rate { align-self: center; line-height: 20px; }
.stay-detail .room-section .entries { border-radius: 0; background: transparent; }
.stay-detail .room-section .entries .entry, .stay-detail .room-section .entries .entry.entry--reviews { padding: 12px 0; }
.stay-detail .entries .entry + .entry::after { left: 48px; right: 0; }
.stay-detail .room-section .acts { position: relative; margin: 8px 0 0; padding: 12px 0; border-radius: 0; background: transparent; box-shadow: none; }
.stay-detail .room-section .rt { position: relative; padding: 16px 0; border-radius: 0; background: transparent; }
.stay-detail .room-section .rt + .rt::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); }
/* 二级屏（设施 / 房型预览 / Vlog 与评价）也用通栏白底 */
.stay-detail.stay-detail--solid:not(.vlog-page) { background: var(--k-paper); }
.stay-detail.stay-detail--solid:not(.vlog-page) :deep(.k-topbar) { background: var(--k-paper) !important; }
.stay-detail .rooms-body, .stay-detail .vlogs-body { padding: 0 16px calc(86px + var(--k-safe-bottom)); background: var(--k-paper); }
.stay-detail .rooms-body .facilities { padding: 16px 0 20px; border-radius: 0; background: transparent; }
.stay-detail .rooms-body .host, .stay-detail .rooms-body .section-head, .stay-detail .vlogs-body .review-head { position: relative; margin-top: 0; border-radius: 0; background: transparent; box-shadow: none; }
.stay-detail .rooms-body .host { padding: 20px 0; }
.stay-detail .rooms-body .host::before, .stay-detail .rooms-body .section-head::before, .stay-detail .vlogs-body .review-head::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); }
.stay-detail .section-head { height: auto; min-height: 22px; margin: 0; padding: 20px 0 12px; }
.stay-detail .vlogs-body > .section-head:first-child { padding-top: 16px; }
.stay-detail .room-list { gap: 0; }
.stay-detail .room-list .room, .stay-detail .room-list .room.card { position: relative; min-height: 0; margin: 0; padding: 12px 0; border-radius: 0; background: transparent; box-shadow: none; align-items: flex-start; }
.stay-detail .room-list .room + .room::before { content: ''; position: absolute; left: 92px; right: 0; top: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); }
.stay-detail .room-list .room > image { width: 80px; height: 80px; flex: 0 0 80px; border-radius: 8px; }
.stay-detail .room-list .room > view { justify-content: flex-start; gap: 4px; min-height: 80px; }
.stay-detail .room-list .room > view > text:first-child { font-size: 15px; font-weight: 600; line-height: 21px; }
.stay-detail .room-list .room > view > text:nth-child(2) { color: var(--k-muted); font-size: 12px; line-height: 18px; }
.stay-detail .room-list .room > view > view { margin-top: auto; padding-top: 4px; }
.stay-detail .vlogs-body .r3-empty--page { min-height: 0; margin: 0; padding: 16px; border-radius: 12px; background: var(--k-page); }
.stay-detail .vlogs-body .r3-empty--page .r3-empty-ic { width: 40px; height: 40px; margin-bottom: 8px; border-radius: 10px; }
.stay-detail .vlogs-body .r3-empty--page .list-empty { margin: 0; padding: 0; color: var(--k-ink); font-size: 14px; font-weight: 500; }
.stay-detail .vlogs-body .r3-empty--page .r3-empty__sub { margin-top: 4px; color: var(--k-muted); font-size: 12px; }
.stay-detail .vlogs-body .guest-card { padding: 0 0 16px; border-radius: 0; background: transparent; }
.stay-detail .vlogs-body .guest-copy { line-height: 22px; }
/* Vlog 详情 */
.stay-detail .vlog-video, .stay-detail .vlog-video--empty { height: 56.25vw; opacity: 1; background: var(--sd-night); }
.stay-detail .vlog-video-ph { height: 56.25vw; background: var(--sd-night); }
.stay-detail .vlog-copy { position: relative; z-index: 1; margin: -16px 0 0; padding: 16px 16px 0; border-radius: 16px 16px 0 0; background: var(--k-paper); }
.stay-detail .author { min-height: 52px; margin-top: 0; }
.stay-detail .author>view>text.vlog-source { display: block; margin-top: 2px; color: var(--k-muted); font-size: 12px; line-height: 18px; }
.stay-detail .author-follow { flex: 0 0 auto; }
.stay-detail .author-follow :deep(.k-button) { height: 28px; margin: 0; padding: 0 12px; border: 0; border-radius: 14px; background: var(--k-red-soft); box-shadow: none; color: var(--k-red-deep); font-size: 12px; font-weight: 500; }
.stay-detail .author-follow.on :deep(.k-button) { background: var(--k-fill); color: var(--k-muted); }
.stay-detail .vlog-comment { min-height: 52px; margin-top: 8px; }
.stay-detail .vlog-copy > .vlog-review-link { position: relative; display: flex; align-items: center; gap: 8px; height: 52px; margin: 0; padding: 0; border-radius: 0; background: transparent; }
.stay-detail .vlog-copy > .vlog-review-link::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); }
.stay-detail .vlog-copy > .vlog-review-link > text { color: var(--k-ink); font-family: var(--k-sans); font-size: 14px; font-weight: 500; }
.stay-detail .vlog-review-link > :deep(.k-icon), .stay-detail .vlog-review-link > k-icon { display: inline-block; }
.stay-detail .vlog-copy > .vlog-review-link > view { display: flex; align-items: center; gap: 2px; margin-left: auto; color: var(--k-muted); font-size: 12px; }
.stay-detail .swipe-next { margin-top: 16px; }
.stay-detail .swipe-next--end :deep(.k-icon) { display: inline-block; }
@media (max-width: 359px) {
  .stay-detail .info-chips { max-height: none; overflow: visible; }
  .stay-detail .overview-body { padding-left: 16px; padding-right: 16px; }
}
/* 第四轮自查返修：设施纯文字之间只用 12 留白（折行时行首不再挂一条竖线）；信息卡和正文左边同一条 16 线；标语 15 号一行放下；
   没有描述的房型名称和价格紧挨（顶对齐）；Vlog 详情白卡四角圆角。 */
.stay-detail .info-chips .ichip--plain + .ichip--plain::before { display: none; }
.stay-detail .info { padding-left: 16px; padding-right: 16px; }
.stay-detail .overview-body { padding-left: 16px; padding-right: 16px; }
.stay-detail .overview-body > .slogan>view text:first-child { font-size: 15px; line-height: 21px; }
.stay-detail .room-list .room > view { min-height: 0; }
.stay-detail .room-list .room > view > view { margin-top: 4px; }
.stay-detail .vlog-copy { border-radius: 16px; }
@media (max-width: 374px) {
  .stay-detail .overview-body > .slogan>view text:first-child { font-size: 14px; line-height: 20px; }
}
/* 11-19 独立复评返修：
   · 标语 ≤389 宽限宽 9.5em，稳定折成两行（不再剩一个「家」）；设施文字 ≤389 宽 12 号、间距 10；320 底栏说明 11 号限宽，在「，」后折行；
   · 「近期生活碎片 / 小院活动」入口同一种行：去掉多出来的 8，加同样的缩进发丝线；
   · 房型预览：没有描述时不占那一行，价格紧跟名称；Vlog 空状态和下面的「住客评价」隔 20；
   · 评价正文的【卫生】拆成小标签 + 正文（和评价页同一种）；
   · 名称旁的收藏 / 分享降成无底色 20 号图标（头图上那套照旧）；Vlog 详情白卡左右留 12 做成浮卡，「住客评价」后的向下箭头 12 号浅灰紧跟数字。 */
.stay-detail .title-actions>view { background: transparent; }
.stay-detail .room-section .acts { margin-top: 0; }
.stay-detail .room-section .acts::before { content: ''; position: absolute; left: 48px; right: 0; top: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); }
.stay-detail .room-list .room > view > text.is-empty { display: none; }
.stay-detail .room-list .room > view > view { margin-top: 0; padding-top: 4px; }
.stay-detail .vlogs-body .r3-empty--page { margin-bottom: 20px; }
.stay-detail .guest-copy--parts { display: flex; flex-direction: column; gap: 4px; }
.stay-detail .guest-para { color: var(--k-ink); font-size: 13px; line-height: 20px; overflow-wrap: anywhere; }
.stay-detail .guest-label { margin-right: 6px; color: var(--k-red-deep); font-size: 12px; font-weight: 600; }
.stay-detail .vlog-copy { margin-left: 12px; margin-right: 12px; }
.stay-detail .vlog-copy > .vlog-review-link > text + .k-icon, .stay-detail .vlog-copy > .vlog-review-link > text + k-icon { margin-left: -4px; }
@media (max-width: 389px) {
  .stay-detail .overview-body > .slogan>view text:first-child { max-width: 9.5em; font-size: 15px; line-height: 21px; }
  .stay-detail .info-chips .ichip--plain { margin-right: 10px; font-size: 12px; }
}
@media (max-width: 359px) {
}
/* 11-19 微信实拍返修：
   · 第一屏只留一套收藏 / 分享（名称右边那两颗），头图上的同一组按钮恢复第三轮的收起；设施文字 12 灰，和前两个标签隔 12；
   · 标语卡的袋鼠印章用 darken 叠在浅棕底上（印章图底色和卡片底色几乎一样，不再露出一块方框），圆角 8；
   · 「3分钟看小院」标题前不再挂实心棕点（和别的区块标题一致）；房型预览没有描述时价格贴住图片底边；设施图标去掉方块底，24 号线稿；
   · Vlog 空状态不套灰底；Vlog 详情：「住客评价」后的向下箭头去掉（右边已有「查看全部」），最后一条时不再挂向下箭头；
     无封面占位深色渐变到深棕、40 号浅灰图标；作者名为空时「门店已审核」升为 14/500、头像 40。 */
.stay-detail .hero-actions { display: none; }
.stay-detail .info-chips .ichip--plain { color: var(--k-muted); font-size: 12px; }
.stay-detail .slogan image { border-radius: 8px; mix-blend-mode: darken; }
.stay-detail .vcard__dot { display: none; }
.stay-detail .room-list .room > view { min-height: 80px; }
.stay-detail .room-list .room > view > view { margin-top: auto; }
.stay-detail .fac-tile { width: 24px; height: 24px; border-radius: 0; background: transparent; }
.stay-detail .facilities>view { font-size: 12px; }
.stay-detail .vlogs-body .r3-empty--page { padding: 24px 0; border-radius: 0; background: transparent; }
.stay-detail .vlog-copy > .vlog-review-link > text + .k-icon, .stay-detail .vlog-copy > .vlog-review-link > text + k-icon { display: none; }
.stay-detail .swipe-next.swipe-next--end .k-icon, .stay-detail .swipe-next.swipe-next--end k-icon { display: none; }
.stay-detail .swipe-next.swipe-next--end :deep(.k-icon) { display: none; }
.stay-detail .vlog-video-ph { background: linear-gradient(180deg, var(--sd-night), var(--k-red-deep)); }
.stay-detail .author.author--noname > image { width: 40px; height: 40px; }
.stay-detail .author.author--noname > view > text.vlog-source { margin-top: 0; color: var(--k-ink2); font-size: 14px; font-weight: 500; line-height: 20px; }
/* <<R6-END>> */

.stay-detail.user-surface {
  .info { border-radius: 14px; }
  .info-price__num { font-variant-numeric: tabular-nums; color: var(--k-red-deep); }
  .sec-card { border-radius: 12px; }
  .location { padding: 8px 12px; border-radius: 10px; background-color: var(--user-inset); }
  .location::before { display: none; }
  .location-copy { min-width: 0; }
  .location-action { color: var(--k-red-deep); }
  .sec-head { align-items: baseline; gap: 8px; }
}
.collection-note { padding: 8px 16px; background: var(--k-paper); font-size: 13px; color: var(--k-ink2); }
</style>
