<template>
  <k-community-gate>
  <!-- #ifdef MP-WEIXIN -->
  <page-meta :page-style="filterOpen ? 'overflow: hidden' : ''" />
  <!-- page-meta 必须是页面第一个节点。找搭子「筛选」弹层开着时锁住页面滚动（弹层自己超高时要能滚，不能用 catchtouchmove 拦）；
       只在小程序里加：H5 的 page-meta 关弹层时清不掉这条样式，顶栏会从此不吸顶（同岗位列表、首页的做法） -->
  <!-- #endif -->
  <view class="k-page community">
    <!-- 同城信息流：品牌与城市、搜索、四个主分类；经验分享展开三个岗位分类。 -->
    <template v-if="s === 1">
      <k-topbar>
        <template #left>
          <view class="brand">
            <text class="brand__name">袋鼠全球青年</text>
            <image class="brand__logo" src="/static/media/brand-kangaroo-lg.png" mode="aspectFit" />
            <view class="brand__city" hover-class="k-press" @click="pickCity"><k-icon name="map-pin" :size="15" color="ink" :stroke="1.8" /><text class="brand__city-name">{{ cityText }}</text><k-icon name="chevron-down" :size="13" color="ink" :stroke="2" /></view>
          </view>
        </template>
        <!-- 输入后点「搜索」或键盘搜索；提示语仅包含支持检索的内容。 -->
        <view class="search">
          <k-icon name="search" :size="17" color="muted" :stroke="1.8" />
          <input v-model="kwDraft" class="search__input" confirm-type="search" maxlength="30" placeholder="搜索搭子、旅居日常、经验分享" placeholder-class="community-search-ph" @confirm="runSearch" />
          <view v-if="kwDraft" class="search__clear" hover-class="k-press" @click="clearSearch"><k-icon name="x" :size="14" color="muted" :stroke="2" /></view>
          <view class="search__btn" aria-role="button" aria-label="搜索社区" hover-class="k-press" @click="runSearch"><k-icon name="search" :size="20" color="white" :stroke="1.7" /></view>
        </view>
        <!-- 心愿互助入口放在找搭子前，点击进入心愿广场。 -->
        <view class="ftabs">
          <view class="ftabs__row">
            <template v-for="t in FEED_TABS" :key="t">
              <view v-if="t === BUDDY_TAB && wishEnabled" class="ftab ftab--wish" hover-class="k-press" aria-role="button" aria-label="进入心愿互助" @click="go(R.wishes)"><text>心愿互助</text></view>
              <view class="ftab" :class="{ on: feedTab === t }" hover-class="k-press" @click="onFeedTab(t)"><text>{{ t }}</text></view>
            </template>
          </view>
          <view v-if="feedTab !== BUDDY_TAB" class="fsort" :class="{ on: sort === 'hot' || sortOpen }" aria-role="button" aria-label="筛选动态排序" hover-class="k-press" @click="toggleSort"><k-icon name="sliders-horizontal" :size="14" color="ink" :stroke="1.7" /><text class="fsort__label">筛选</text></view>
          <view v-if="sortOpen" class="fmask" @click="sortOpen = false" @touchmove.stop.prevent />
          <view v-if="sortOpen" class="fmenu">
            <view v-for="o in SORTS" :key="o.key" class="fmenu__item" :class="{ on: sort === o.key }" hover-class="k-press" @click="pickSort(o.key)"><text>{{ o.label }}</text><k-icon v-if="sort === o.key" name="check" :size="16" color="red" /></view>
          </view>
        </view>
        <view v-if="feedTab === DIARY_TAB" class="subchips">
          <view v-for="j in JOB_CHIPS" :key="j.key" class="subchip" :class="{ on: jobType === j.key }" hover-class="k-press" aria-role="button" :aria-label="j.label + (jobType === j.key ? '，已选择，再点取消筛选' : '')" @click="setJobType(j.key)"><text>{{ j.label }}</text></view>
        </view>
      </k-topbar>

      <view class="feed k-pad-tab">
        <view v-if="feedTab === '全部'" class="werewolf-entry" hover-class="k-press" @click="go(R.werewolf)">
          <view class="werewolf-entry__icon"><k-icon name="moon-star" :size="23" color="green" /></view>
          <view class="werewolf-entry__copy"><text class="werewolf-entry__title">袋鼠狼人杀</text><text class="werewolf-entry__hint">围坐一桌，邀请朋友开一局</text></view>
          <k-icon name="chevron-right" :size="19" color="green" />
        </view>
        <view v-if="feedTab === '全部'" class="werewolf-entry undercover-entry" hover-class="k-press" aria-role="button" aria-label="谁是卧底" @click="go(R.undercover)">
          <view class="werewolf-entry__icon"><k-icon name="search" :size="23" color="red" /></view>
          <view class="werewolf-entry__copy"><text class="werewolf-entry__title">谁是卧底</text><text class="werewolf-entry__hint">4～10人，听出朋友话里的不同</text></view>
          <k-icon name="chevron-right" :size="19" color="red" />
        </view>
        <view v-if="feedTab === '全部'" class="party-tools-entry" hover-class="k-press" @click="go('/pages/party/index')"><k-icon name="dices" :size="20" color="green"/><text>好友桌游</text><text class="k-flex1">大富翁 · 多人骰子</text><k-icon name="chevron-right" :size="16"/></view>
        <view v-if="feedTab === '全部'" class="party-tools-entry" @click="go('/pages/undercover/tools')"><k-icon name="dices" :size="20" color="green"/><text>聚会小工具</text><text class="k-flex1">真心话 · 骰子 · 倒计时</text><k-icon name="chevron-right" :size="16"/></view>
        <view v-if="keyword" class="kwline"><text class="kwline__text">搜索「{{ keyword }}」的结果</text><view class="kwline__clear" hover-class="k-press" @click="clearSearch"><text>清除搜索</text></view></view>
        <view v-if="sort === 'follow' && feedTab !== BUDDY_TAB" class="kwline"><text class="kwline__text">我关注的人发的动态 · 不分城市</text></view>

        <!-- 找搭子：留在社区页，下面换成分类小字 +「筛选」+ 出行安全须知 + 找搭子列表 -->
        <template v-if="feedTab === BUDDY_TAB">
          <view class="bbar">
            <scroll-view scroll-x class="bbar__cats" :show-scrollbar="false">
              <view class="bbar__row">
                <view v-for="c in cats" :key="c" class="subchip" :class="{ on: cat === c }" hover-class="k-press" @click="setCat(c)"><text>{{ c }}</text></view>
              </view>
            </scroll-view>
            <view class="bbar__filter" :class="{ on: !!activeFilters.length }" hover-class="k-press" @click="openFilter"><k-icon name="sliders-horizontal" :size="15" :color="activeFilters.length ? 'red' : 'ink'" :stroke="1.8" /><text>筛选</text><text v-if="activeFilters.length" class="bbar__num">{{ activeFilters.length }}</text></view>
          </view>
          <!-- 选了的筛选条件亮在这里，点一下去掉这一条 -->
          <view v-if="activeFilters.length" class="ftags">
            <view v-for="f in activeFilters" :key="f.key" class="ftag" hover-class="k-press" @click="clearFilter(f.key)"><text>{{ f.label }}</text><k-icon name="x" :size="11" color="red" :stroke="2.2" /></view>
          </view>
          <!-- 2026-10-19 选的城市一个找搭子都没有、在自动看全国的：一行暖色小字 +「只看X」 -->
          <view v-if="wideNow" class="wide-note"><k-icon name="compass" :size="15" color="#A9581C" :stroke="1.9" /><text class="wide-note__text">{{ wideText }}</text><view class="wide-note__back" hover-class="k-press" @click="onlyThisCity"><text class="wide-note__city">只看{{ city }}</text><k-icon name="chevron-right" :size="13" color="red" :stroke="2" /></view></view>
          <!-- 找搭子是用户之间自愿结伴：列表上常驻《找搭子安全须知》入口，点开看全文 -->
          <view class="safety-line" hover-class="k-press" @click="openBuddySafety"><k-icon name="shield-alert" :size="15" color="ochre" :stroke="1.8" /><text class="safety-line__title">出行安全须知</text><text class="k-flex1 safety-line__sub">自愿结伴 · 遇险拨打 110</text><k-icon name="chevron-right" :size="14" color="ink2" /></view>

          <view v-for="mate in mates" :key="mate.postId" class="card mate" hover-class="k-press-s" @click="openPost(mate.postId)">
            <view class="mate__main">
              <!-- 没有图时左边放分类小图标 + 出发日期，不拿「暂无图片」占位图凑 -->
              <view class="mate__tile">
                <image v-if="mate.img" class="mate__img" :src="mate.img" mode="aspectFill" />
                <template v-else>
                  <k-icon :name="mate.icon" :size="26" color="red" :stroke="1.6" />
                  <text class="mate__day">{{ mate.day }}</text>
                </template>
              </view>
              <view class="mate__body">
                <text class="mate__title">{{ displayWording(mate.title, [mate.author.name]) }}</text>
                <view class="mate__chips">
                  <k-chip v-if="mate.activity" tone="green">活动{{ mate.activity.label }}</k-chip>
                  <k-chip v-if="mate.status === 'pending'" tone="ochre">动态待审核·仅自己可见</k-chip>
                  <k-chip v-if="mate.categoryLabel && mate.categoryLabel!=='其他'" tone="ink">{{ mate.categoryLabel }}</k-chip>
                  <k-chip v-if="mate.genderLimit" tone="red">{{ mate.genderLimitLabel }}</k-chip>
                  
                  
                </view>
                <view class="mate__row"><k-icon name="clock" :size="14" color="muted" :stroke="1.6" /><text class="mate__row-text">{{ mate.time }}</text></view>
                <view class="mate__row"><k-icon name="map-pin" :size="14" color="muted" :stroke="1.6" /><text class="mate__row-text">{{ mate.place }} · {{ mate.daysText }}</text></view>
              </view>
            </view>
            <view class="mate__foot">
              <view class="mate__who" hover-class="k-press" @click.stop="openUser(mate.author.userId)">
                <image class="mate__avatar" :src="mate.avatar" mode="aspectFill" />
                <text class="mate__name">{{ mate.author.name }}</text><text v-if="mate.author.isMe" class="own-marker">（我）</text>
              </view>
              <view v-if="mate.count" class="mate__signed">
                <view class="avs"><image v-for="(a, i) in mate.avatars" :key="i" class="avs__a" :src="a" mode="aspectFill" /></view>
                <text>{{ mate.count }}人报名</text>
              </view>
              <!-- 小程序里按钮内部的原生 tap 会冒泡到外层卡片：之前点「发起认识一下」同时打开了帖子详情；外层 view 拦住冒泡 -->
              <view v-if="privateChatEnabled || mate.author.isMe" @click.stop><k-button size="sm" @click.stop="meet(mate)">{{ mate.author.isMe ? (mate.activity?.isMine ? '管理活动' : '我的发布') : '发起认识一下' }}</k-button></view>
            </view>
          </view>
          <view v-if="buddiesFailed && !mates.length" class="feed-empty">
            <text class="feed-empty__title">找搭子没加载出来</text>
            <view class="feed-empty__retry" hover-class="k-press" @click="loadBuddies()"><text>重新加载</text></view>
          </view>
          <view v-else-if="buddiesLoaded && !mates.length" class="feed-empty">
            <k-icon name="users" :size="30" color="muted" />
            <text class="feed-empty__title">{{ keyword ? '没有搜到相关的搭子' : '暂时没有符合条件的搭子' }}</text>
            <text class="feed-empty__sub">{{ keyword ? '换个关键词试试' : '换个城市、日期或分类看看，也可以点底部「发布」自己发起' }}</text>
            <view v-if="canWiden" class="feed-empty__retry" hover-class="k-press" @click="seeNationwide"><text>看看全国的</text></view>
          </view>
          <view v-else-if="!buddiesLoaded" class="feed-loading"><text>正在加载…</text></view>
        </template>

        <!-- 全部 / 旅居日常 / 经验分享 -->
        <template v-else>
          <!-- 2026-10-19 选的城市这个页签空着、在自动看全国的：一行暖色小字 +「只看X」（点了回到只看这个城市） -->
          <view v-if="wideNow" class="wide-note"><k-icon name="compass" :size="15" color="#A9581C" :stroke="1.9" /><text class="wide-note__text">{{ wideText }}</text><view class="wide-note__back" hover-class="k-press" @click="onlyThisCity"><text class="wide-note__city">只看{{ city }}</text><k-icon name="chevron-right" :size="13" color="red" :stroke="2" /></view></view>
          <view v-if="sort === 'follow' && feedLoaded && !posts.length" class="feed-empty">
            <k-icon name="users" :size="30" color="muted" />
            <text class="feed-empty__title">{{ signedIn ? '你关注的人还没有发动态' : '登录后可以看你关注的人的动态' }}</text>
            <text class="feed-empty__sub">点帖子作者的头像进 TA 的主页，点「关注」后，TA 发的动态会出现在这里。</text>
          </view>
          <!-- 之前其他筛选下没有动态、或加载失败时一片空白，看不出是没有还是没加载出来 -->
          <view v-else-if="feedFailed && !posts.length" class="feed-empty">
            <text class="feed-empty__title">动态没加载出来</text>
            <view class="feed-empty__retry" hover-class="k-press" @click="loadFeed()"><text>重新加载</text></view>
          </view>
          <view v-else-if="feedLoaded && !posts.length" class="feed-empty">
            <k-icon :name="feedTab === DIARY_TAB ? 'book-open' : 'message-circle'" :size="30" color="muted" />
            <text class="feed-empty__title">{{ emptyTitle }}</text>
            <text class="feed-empty__sub">{{ emptySub }}</text>
            <view v-if="canWiden" class="feed-empty__retry" hover-class="k-press" @click="seeNationwide"><text>看看全国的</text></view>
            <view v-if="feedTab === DIARY_TAB && !keyword" class="feed-empty__retry" hover-class="k-press" @click="goJobs"><text>去找机会</text></view>
          </view>
          <view v-else-if="!feedLoaded" class="feed-loading"><text>正在加载…</text></view>

          <!-- 信息流保留原有顺序；照片、正文、作者依次排布，用留白和分隔线区分帖子。 -->
          <view v-for="b in blocks" :key="b.key" class="blk">
            <view v-if="b.type === 'pair'" class="fc-pair">
              <view v-for="c in b.items" :key="c.key" class="fc-pair__cell">
                <view v-if="c.act" class="card fc-act fc-act--col" :class="{ 'fc-act--plain': !c.act.img }" hover-class="k-press-s" @click="openActivity(c.act)">
                  <image v-if="c.act.img" class="fc-act__img" :src="c.act.img" mode="aspectFill" />

                  <view class="fc-act__tag"><text>{{ c.act.top ? '置顶活动' : '热门活动' }}</text></view>
                  <view class="fc-act__copy">
                    <text class="fc-act__title">{{ displayWording(c.act.title) }}</text>
                    <text class="fc-act__meta">{{ c.act.date }}</text>
                    <text class="fc-act__meta">{{ c.act.metaText }}</text>

                  </view>
                </view>
                <view v-else class="card fc-col" :class="'kd-' + c.post.kindKey" hover-class="k-press-s" @click="openPost(c.post.postId)">
                  <view v-if="c.post.imgs.length" class="fc-col__media" :class="{ 'fc-col__media--pair': c.post.imgs.length > 1 }">
                    <view class="fc-col__gallery"><image v-for="(photo, photoIndex) in c.post.imgs.slice(0, 2)" :key="photoIndex" class="fc-col__img" :src="photo" mode="aspectFill" /></view>
                    <view v-if="c.post.imgCount > 1" class="img-count"><k-icon name="images" :size="11" color="white" :stroke="1.7" /><text>{{ c.post.imgCount }}</text></view>
                  </view>
                  <view v-else class="fc-col__cover">

                    <view v-if="c.post.kindText" class="kicker"><text class="kicker__kind">{{ c.post.kindText }}</text><text v-if="c.post.place" class="kicker__place">· {{ c.post.place }}</text></view>
                    <text class="fc-col__cover-title">{{ c.post.titleText }}</text>
                  </view>
                  <view class="fc-col__body">
                    <text v-if="c.post.imgs.length" class="fc-col__title">{{ c.post.titleText }}</text>
                    <text v-else-if="c.post.content" class="fc-col__text">{{ displayWording(c.post.content, [c.post.author?.name]) }}</text>
                    <!-- 和大卡片一样的小标签：审核中 / 仅限女生·男生 / 伙伴说（之前半张卡只显示审核中） -->
                    <view v-if="c.post.tags.length" class="fc__tags fc-col__tags"><k-chip v-for="t in c.post.tags" :key="t.key" :tone="t.tone">{{ t.text }}</k-chip></view>
                    <view v-if="c.post.link" class="fc-col__link" hover-class="k-press" @click.stop="openLink(c.post.link)"><k-icon name="link" :size="12" color="red" :stroke="2" /><text class="fc-col__link-text">关联：{{ displayWording(c.post.link.title) }}</text></view>
                    <!-- 320 宽：赞是 0 时不写 0、评论数不显示，作者名字不再被挤成两个字 -->
                    <view class="fc-col__foot">
                      <view class="fc-col__who" hover-class="k-press" @click.stop="openUser(c.post.author.userId)">
                        <image class="fc-col__avatar" :src="c.post.avatar" mode="aspectFill" />
                        <text class="fc-col__name">{{ c.post.name }}</text><text v-if="c.post.author.isMe" class="own-marker">（我）</text>
                      </view>
                      <!-- 2026-10-19：赞 / 评论是 0 时只放图标、不写「0」（「♡0 💬0」看着冷清，和大卡片「赞」不带数字一个做法） -->
                      <view class="fc-col__stat" :class="{ 'fc-col__stat--off': !canInteract(c.post) }" hover-class="k-press" @click.stop="likePost(c.post)"><k-icon name="heart" :size="17" :color="c.post.liked ? 'red' : canInteract(c.post) ? 'muted' : 'light'" :stroke="1.8" :fill="!!c.post.liked" /><text v-if="c.post.likes" class="fc-col__num">{{ c.post.likes }}</text><text v-else>赞</text></view>
                      <view class="fc-col__stat fc-col__stat--cmt" :class="{ 'fc-col__stat--off': !canInteract(c.post) }" hover-class="k-press" @click.stop="openPostComments(c.post)"><k-icon name="message-circle-more" :size="17" :color="canInteract(c.post) ? 'muted' : 'light'" :stroke="1.8" /><text v-if="c.post.comments" class="fc-col__num">{{ c.post.comments }}</text><text v-else>评论</text></view>
                    </view>
                    <view v-if="c.post.author.member?.achievement" class="fc-col__achievement" hover-class="k-press" @click.stop="openUser(c.post.author.userId)">
                      <member-mark :member="{ achievement: c.post.author.member.achievement }" />
                    </view>
                  </view>
                </view>
              </view>
            </view>

            <view v-else-if="b.type === 'act'" class="card fc-act fc-act--wide feed-card" :class="{ 'fc-act--plain': !b.act.img }" hover-class="k-press-s" @click="openActivity(b.act)">
              <view class="fc-act__copy">
                <view class="fc-act__tag"><text>{{ b.act.top ? '置顶活动' : '热门活动' }}</text></view>
                <text class="fc-act__title">{{ displayWording(b.act.title) }}</text>
                <text v-if="b.act.date" class="fc-act__meta">{{ b.act.date }}</text>
                <text v-if="b.act.metaText" class="fc-act__meta">{{ b.act.metaText }}</text>
              </view>
              <image v-if="b.act.img" class="fc-act__img" :src="b.act.img" mode="aspectFill" />
            </view>

            <!-- 大图、文字和右侧缩略图共用正文、作者与互动区。 -->
            <view v-else class="card fc feed-card" :class="['fc--' + b.type, 'kd-' + b.post.kindKey]">
              <view v-if="b.type === 'hero'" class="fc__media" hover-class="k-press" @click="openPost(b.post.postId)">
                <image class="fc__img fc__media-img" :src="b.post.imgs[0]" mode="aspectFill" />
                <text v-if="b.post.pinned" class="fc__pin">置顶</text>
                <view v-if="b.post.imgCount > 1" class="img-count"><k-icon name="images" :size="11" color="white" :stroke="2" /><text>{{ b.post.imgCount }}</text></view>
              </view>
              <!-- 纯文字开篇使用真实分类，无占位图片。 -->
              <view v-else-if="b.type === 'lead'" class="fc__band" hover-class="k-press" @click="openPost(b.post.postId)">

                <view v-if="b.post.kindText" class="kicker kicker--band"><text class="kicker__kind">{{ b.post.kindText }}</text><text v-if="b.post.place" class="kicker__place">· {{ b.post.place }}</text><text v-if="b.post.pinned" class="kicker__pin">置顶</text></view>

              </view>
              <view class="fc__panel">
                <view class="fc__body" hover-class="k-press" @click="openPost(b.post.postId)">
                  <view class="fc__copy">
                    <view v-if="b.post.kindText && b.type !== 'lead'" class="kicker"><text class="kicker__kind">{{ b.post.kindText }}</text><text v-if="b.post.place" class="kicker__place">· {{ b.post.place }}</text><text v-if="b.post.pinned && b.type !== 'hero'" class="kicker__pin">置顶</text></view>
                    <text class="fc__title">{{ b.post.titleText }}</text>
                    <!-- 正文只保留两行摘要，点击阅读全文。 -->
                    <view v-if="b.post.content && b.type === 'text'" class="fc__excerpt"><text class="fc__text fc__text--quote">{{ displayWording(b.post.content, [b.post.author?.name]) }}</text></view>
                    <text v-else-if="b.post.content" class="fc__text">{{ displayWording(b.post.content, [b.post.author?.name]) }}</text>
                  </view>
                  <view v-if="b.type === 'thumb'" class="fc__thumb">
                    <image class="fc__img" :src="b.post.imgs[0]" mode="aspectFill" />
                    <view v-if="b.post.imgCount > 1" class="img-count"><k-icon name="images" :size="11" color="white" :stroke="2" /><text>{{ b.post.imgCount }}</text></view>
                  </view>
                </view>
                <view class="fc__who">
                  <!-- 之前点头像、名字没反应；现在都进作者的个人主页 -->
                  <image class="fc__avatar" :class="{'member-frame':b.post.author.member?.frame}" :src="b.post.avatar" mode="aspectFill" @click="openUser(b.post.author.userId)" />
                  <view class="fc__meta">
                    <view class="fc__name-row">
                      <text class="fc__name" @click="openUser(b.post.author.userId)">{{ b.post.name }}</text><text v-if="b.post.author.isMe" class="own-marker">（我）</text><member-mark :member="b.post.author.member" />
                      
                    </view>
                    <view class="fc__submeta"><text class="fc__date">{{ b.post.dateText }}</text></view>
                  </view>
                  <view v-if="privateChatEnabled && !b.post.isMe" class="follow" :class="{ on: b.post.followed }" hover-class="k-press" @click="toggleFollow(b.post)"><text>{{ b.post.followed ? '已关注' : '关注' }}</text></view>
                </view>
                <view v-if="b.post.tags.length" class="fc__tags"><k-chip v-for="t in b.post.tags" :key="t.key" :tone="t.tone">{{ t.text }}</k-chip></view>
                <!-- 2026-10-17 关联：帖子关联了 小院 / 门店、岗位 或 活动时多一行，点了直接打开它 -->
                <view v-if="b.post.link" class="fc__link" hover-class="k-press" @click="openLink(b.post.link)"><k-icon name="link" :size="14" color="red" :stroke="2" /><text class="fc__link-tag">{{ b.post.link.label }}</text><text class="fc__link-title">关联：{{ displayWording(b.post.link.title) }}</text><k-icon name="chevron-right" :size="14" color="muted" /></view>
                <view class="fc__actions">
                  <!-- 2026-10-17：自己审核中的帖子（只有自己在信息流里看得到）赞 / 评论灰掉，点了提示「审核通过后才能点赞、收藏和评论」 -->
                  <view class="fc__act" :class="{ 'fc__act--off': !canInteract(b.post) }" hover-class="k-press" @click="likePost(b.post)"><k-icon name="heart" :size="17" :color="b.post.liked ? 'red' : canInteract(b.post) ? 'muted' : 'light'" :stroke="1.7" :fill="!!b.post.liked" /><text>{{ b.post.likes ? '赞 ' + b.post.likes : '赞' }}</text></view>
                  <view class="fc__act" :class="{ 'fc__act--off': !canInteract(b.post) }" hover-class="k-press" @click="openPostComments(b.post)"><k-icon name="message-circle-more" :size="17" :color="canInteract(b.post) ? 'ink2' : 'light'" :stroke="1.7" /><text>{{ b.post.comments ? '评论 ' + b.post.comments : '评论' }}</text></view>
                  <!-- 之前点「分享」只弹一句「请点击右上角…转发给朋友」；现在小程序里一点就打开微信的转发面板（发给朋友 / 群），H5 复制链接 -->
                  <!-- 审核中的动态别人打不开：小程序里不给转发按钮，点「分享」提示「动态审核通过后才能分享」（shareOther 先拦） -->
                  <!-- #ifdef MP-WEIXIN -->
                  <button v-if="canShare(b.post)" class="fc__act fc__act--share share-btn" open-type="share" hover-class="k-press" :data-post-id="b.post.postId"><k-icon name="share" :size="17" color="ink2" :stroke="1.7" /><text>分享</text></button>
                  <view v-else class="fc__act fc__act--share fc__act--off" hover-class="k-press" @click="shareOther(b.post)"><k-icon name="share" :size="17" color="light" :stroke="1.7" /><text>分享</text></view>
                  <!-- #endif -->
                  <!-- #ifndef MP-WEIXIN -->
                  <view class="fc__act fc__act--share" :class="{ 'fc__act--off': !canShare(b.post) }" hover-class="k-press" @click="shareOther(b.post)"><k-icon name="share" :size="17" :color="canShare(b.post) ? 'ink2' : 'light'" :stroke="1.7" /><text>分享</text></view>
                  <!-- #endif -->
                </view>
              </view>
            </view>
            <!-- 第一张热门活动卡下面：进完整的活动列表（原来顶上「本周热门 · 更多」的入口，改版后没了） -->
            <view v-if="b.moreActs" class="acts-more"><view class="acts-more__link" hover-class="k-press" @click="go(R.activity)"><text>更多活动</text><k-icon name="chevron-right" :size="14" color="red" :stroke="2" /></view></view>
          </view>
          <view v-if="posts.length && !feed.hasMore" class="feed-end"><text>没有更多了</text></view>
        </template>
      </view>
      <k-tabbar active="community" />

      <!-- 找搭子「筛选」：出发日期 / 同行天数 / 同行性别 / 只看已验证，点「确定」才生效 -->
      <view v-if="filterOpen" class="k-mask" @click="filterOpen = false" @touchmove.stop.prevent />
      <view v-if="filterOpen" class="k-sheet fsheet">
        <view class="k-sheet__handle" />
        <view class="fsheet__head"><text class="fsheet__title">筛选搭子</text><view class="fsheet__close" hover-class="k-press" @click="filterOpen = false"><k-icon name="x" :size="18" color="ink" :stroke="2" /></view></view>
        <text class="fsheet__label">活动状态</text><view class="fsheet__pills activity-phase-filter"><view v-for="phase in ACTIVITY_PHASES" :key="phase.key" class="fpill" :class="{on:fd.activityPhase===phase.key}" @click="fd.activityPhase=phase.key"><text>{{phase.label}}</text></view></view><text class="fsheet__label">出发日期</text>
        <view class="fsheet__pills">
          <view class="fpill" :class="{ on: !fd.date }" hover-class="k-press" @click="fd.date = ''"><text>不限</text></view>
          <view class="fpill" :class="{ on: !!fd.date }" hover-class="k-press" @click="pickFilterDate"><k-icon name="calendar-days" :size="14" :color="fd.date ? 'white' : 'ink2'" :stroke="1.8" /><text>{{ fd.date ? mdText(fd.date) + ' 出发' : '选日期' }}</text></view>
        </view>
        <text class="fsheet__label">同行天数</text>
        <view class="fsheet__pills">
          <view v-for="d in DAY_FILTERS" :key="d.label" class="fpill" :class="{ on: fd.days === d.key }" hover-class="k-press" @click="fd.days = d.key"><text>{{ d.label }}</text></view>
        </view>
        <text class="fsheet__label">同行性别</text>
        <view class="fsheet__pills">
          <view v-for="g in GENDER_FILTERS" :key="g.key" class="fpill" :class="{ on: fd.gender === g.key }" hover-class="k-press" @click="fd.gender = g.key"><text>{{ g.label }}</text></view>
        </view>
        <view class="fsheet__switch" hover-class="k-press" @click="fd.verified = !fd.verified">
          <view class="k-flex1"><text class="fsheet__switch-title">只看已验证的发布者</text><text class="fsheet__switch-sub">手机已验证或行程已验证</text></view>
          <view class="k-switch" :class="{ on: fd.verified }" />
        </view>
        <view class="fsheet__help" hover-class="k-press" @click="explainTrip"><k-icon name="circle-help" :size="14" color="muted" /><text>什么是「行程已验证」？</text></view>
        <view class="fsheet__foot">
          <view class="fsheet__reset" hover-class="k-press" @click="resetFilter"><text>重置</text></view>
          <view class="k-flex1"><k-button block @click="applyFilter">确定</k-button></view>
        </view>
      </view>
      <!-- 找搭子的出发日期：日历点选（两周内） -->
      <k-date-picker v-if="dateOpen" title="选择出发日期" allow-empty :value="fd.date" :min-date="todayCn()" :max-date="shiftDate(todayCn(), 13)" @cancel="dateOpen = false" @confirm="confirmDate" />
    </template>

    <!-- 3 帖子详情 -->
    <template v-else-if="s === 3">
      <k-topbar title="帖子详情" back custom-back @back="leavePost" /><view v-if="detail.author?.isMe" class="post-owner-actions"><button :disabled="deletingPost" hover-class="k-press" @click="deleteOwnPost"><k-icon name="trash-2" :size="14" color="alert" /> 删除动态</button></view>
      <view class="detail">
        <view v-if="heroImgs.length" class="hero" @click="previewHero">
          <!-- 之前只显示第 1 张图，「1/3」和小圆点只是摆设、左右划不动；现在多张图可以左右滑动，页码和圆点跟着变 -->
          <swiper v-if="heroImgs.length > 1" class="hero__img" :current="imgIdx" @change="imgIdx = $event.detail.current"><swiper-item v-for="(src, i) in heroImgs" :key="i"><image class="hero__img" :src="src" mode="aspectFill" /></swiper-item></swiper>
          <image v-else class="hero__img" :src="heroImg" mode="aspectFill" />
          <view v-if="heroImgs.length > 1" class="hero__badge"><text>{{ heroBadge }}</text></view>
          <view v-if="heroImgs.length > 1" class="hero__dots"><view v-for="(src, i) in heroImgs" :key="i" class="hero__dot" :class="{ on: i === imgIdx }" /></view>
        </view>
        <!-- 2026-10-19：没图的帖子之前顶上一大块「暂无图片」占位图 +「1/1」；现在和信息流的开篇卡一样，换成类型色条（类型小字 + 城市 + 浅色大引号 + 袋鼠贴纸） -->
        <view v-else class="dband" :class="'kd-' + detailKindKey">
          <view class="dband__quote"><k-icon name="quote" :size="56" :color="detailKindColor" :stroke="1" fill /></view>
          <view v-if="detailKindLabel" class="kicker kicker--band"><text class="kicker__kind">{{ detailKindLabel }}</text><text v-if="detail.city" class="kicker__place">· {{ detail.city }}</text></view>
          <image class="dband__logo" src="/static/media/brand-kangaroo.png" mode="aspectFit" />
        </view>
        <view class="k-body">
          <view class="post__head">
            <image class="post__avatar post__avatar--lg" :class="{'member-frame':detail.author.member?.frame}" :src="authorAvatar" mode="aspectFill" @click="openUser(detail.author.userId)" />
            <view class="k-flex1">
              <view class="k-row k-gap6 who"><text class="post__name post__name--lg" @click="openUser(detail.author.userId)">{{ detail.author.name }}{{ detail.author.isMe ? '（我）' : '' }}</text><member-mark :member="detail.author.member" /><k-chip v-if="detail.author.phoneVerified" tone="ochre">手机已验证</k-chip><k-chip v-if="detail.author.tripVerified" tone="green">行程已验证</k-chip></view>
              <view class="k-row k-gap10 k-mt4"><text class="k-meta">{{ detail.createTimeText }}</text><text class="k-meta">{{ detail.city }}</text></view>
            </view>
            <view v-if="privateChatEnabled && !detail.author.isMe" class="follow follow--lg" :class="{ on: detail.author.followed }" hover-class="k-press" @click="toggleFollow(detail)"><text>{{ detail.author.followed ? '已关注' : '关注' }}</text></view>
          </view>
          <k-display-text class="detail__title" :value="titleOf(detail)" :preserve="[detail.author.name]" />
          <view v-if="detail.author.isMe && detail.status === 'online' && detail.author.member?.level >= 2" class="k-row k-gap8 k-mt8" hover-class="k-press" @click="go('/pages/profile/member-wallet?tab=community')"><k-icon name="arrow-up" :size="16" color="ochre" /><text class="k-muted">使用会员置顶 · 查看本周次数</text></view>
          <view v-if="detail.kind === 'buddy' && detail.genderLimit" class="k-row k-mt8"><k-chip tone="red">{{ detail.genderLimitLabel }}</k-chip></view>
          <view v-if="detail.toneLabel" class="k-row k-mt8"><k-chip :tone="detail.tone === 'avoid' ? 'red' : 'green'">伙伴说 · {{ detail.toneLabel }}</k-chip></view>
          <k-display-text class="detail__body k-pre" :value="detail.content || ''" :preserve="[detail.author.name]" />
          <!-- 2026-10-17 主人反馈：作者看自己审核中的帖子时，正文下面一行小字说明为什么赞 / 评论 / 收藏是灰的 -->
          <view v-if="detail.status === 'pending' && detail.author.isMe" class="pending-line"><k-icon name="clock" :size="14" color="ochre" :stroke="1.8" /><text>社区动态待审核，仅自己可见。通过后可点赞、收藏和评论。</text></view>
          <view v-if="detail.activity" class="pending-line"><k-icon name="calendar" :size="14" color="green" /><text>关联活动：{{ detail.activity.label }}</text></view>
          <view class="k-row k-gap8 k-mt16">
            <view v-for="t in detail.tags" :key="t" class="tag"><text>#</text><text>{{ t }}</text></view>
          </view>
          <!-- 2026-10-17 关联：发帖人关联的 小院 / 门店、岗位 或 活动（经验分享是经历的岗位），点了直接打开 -->
          <view v-if="detailLink" class="link-card" hover-class="k-press-s" @click="openLink(detailLink)">
            <image v-if="detailLink.cover" class="link-card__img" :src="absUrl(detailLink.cover)" mode="aspectFill" />
            <view v-else class="link-card__img link-card__img--empty"><k-icon name="link" :size="18" color="red" :stroke="1.9" /></view>
            <view class="k-flex1 link-card__copy"><text class="link-card__label">关联</text><text class="link-card__title">{{ displayWording(detailLink.title) }}</text><text v-if="detailLink.city || detailLink.sub" class="link-card__sub">{{ [detailLink.city, detailLink.sub].filter(Boolean).join(' · ') }}</text></view>
            <text class="link-card__tag">{{ detailLink.label }}</text>
            <k-icon name="chevron-right" :size="15" color="muted" />
          </view>
          <!-- 之前找搭子帖同步出来的活动（列表卡片上还显示「N人报名」）在帖子里没有任何入口，看了帖子没法报名；现在给出活动入口 -->
          <view v-if="detail.activityId" class="act-link" hover-class="k-press" @click="go(R.activity + '?id=' + detail.activityId + '&channel=community')"><k-icon name="calendar-days" :size="18" color="green" :stroke="1.8" /><text class="k-flex1">发布者同步发起了活动，查看详情 / 报名</text><k-icon name="chevron-right" :size="15" color="muted" /></view>
          <view v-if="detail.kind === 'buddy'" class="safety-line safety-line--detail" hover-class="k-press" @click="openBuddySafety"><k-icon name="shield-alert" :size="15" color="ochre" :stroke="1.8" /><text class="safety-line__title">出行安全须知</text><text class="k-flex1 safety-line__sub">结伴前请先看一看</text><k-icon name="chevron-right" :size="14" color="muted" /></view>
          <view class="k-divider k-mt20" />
          <view class="k-section"><text class="k-section__title">关联推荐</text><view class="k-section__more" hover-class="k-press" @click="go(R.home)"><text>查看全部</text><k-icon name="chevron-right" :size="13" color="muted" /></view></view>
          <view class="k-grid-3 rel">
            <view v-for="r in detail.related" :key="r.kind" class="rel__card" :class="`rel__card--${r.tone}`" hover-class="k-press-s" @click="go(r.to)">
              <view class="rel__chip" :class="`rel__chip--${r.tone}`"><text>{{ r.kind }}</text></view>
              <text class="rel__title">{{ displayWording(r.title) }}</text>
              <view class="rel__meta"><text v-if="r.price" class="rel__price">{{ r.price }}</text><text>{{ r.meta }}</text></view>
              <view class="rel__status" :class="`rel__status--${r.statusTone}`"><k-icon v-if="r.shield" name="shield-check" :size="16" color="green" :stroke="1.8" fill /><text>{{ r.status }}</text></view>
              <image class="rel__img" :src="r.img ? absUrl(r.img) : ''" mode="aspectFill" />
            </view>
          </view>
        </view>
        <!-- 之前最后一段（关联推荐）被底部操作栏挡住、滑不到底；现在底部垫一块和操作栏一样高（含手机底部安全区）的空白 -->
        <view class="actbar-spacer" />
      </view>
      <!-- 2026-10-17 主人反馈：审核中（没发布）的帖子 赞 / 评论 / 收藏 灰掉，点了提示「审核通过后才能点赞、收藏和评论」（服务端 409 兜底）；
           分享的帖子别人打不开，同样灰掉，点了提示「动态审核通过后才能分享」。之前点过的赞 / 收藏照常亮着，可以取消 -->
      <view class="actbar">
        <view class="actbar__item" :class="{ 'actbar__item--off': !detailOpen }" hover-class="k-press" @click="likePost(detail)"><k-icon name="heart" :size="24" :color="detail.liked ? 'red' : detailOpen ? 'ink' : 'light'" :stroke="1.5" :fill="!!detail.liked" /><text>{{ detail.likes ? '赞 ' + detail.likes : '赞' }}</text></view>
        <view class="actbar__item" :class="{ 'actbar__item--off': !detailOpen }" hover-class="k-press" @click="openComments"><!-- 2026-10-17 主人圈出：圆形气泡 24px 看着像一个空心圆，换成带三个点的气泡 --><k-icon name="message-circle-more" :size="24" :color="detailOpen ? 'ink' : 'light'" :stroke="1.5" /><text>{{ detail.comments ? '评论 ' + detail.comments : '评论' }}</text></view>
        <view class="actbar__item" :class="{ 'actbar__item--off': !detailOpen }" hover-class="k-press" @click="favoritePost"><k-icon name="star" :size="24" :color="detail.favorited ? 'ochre' : detailOpen ? 'ink' : 'light'" :stroke="1.5" :fill="!!detail.favorited" /><text>{{ detail.favorited ? '已收藏' : '收藏' }}</text></view>
        <!-- #ifdef MP-WEIXIN -->
        <button v-if="canShare(detail)" class="actbar__item share-btn" open-type="share" hover-class="k-press" :data-post-id="detail.postId"><k-icon name="share" :size="24" color="ink" :stroke="1.5" /><text>分享</text></button>
        <view v-else class="actbar__item actbar__item--off" hover-class="k-press" @click="shareOther(detail)"><k-icon name="share" :size="24" color="light" :stroke="1.5" /><text>分享</text></view>
        <!-- #endif -->
        <!-- #ifndef MP-WEIXIN -->
        <view class="actbar__item" :class="{ 'actbar__item--off': !canShare(detail) }" hover-class="k-press" @click="shareOther(detail)"><k-icon name="share" :size="24" :color="canShare(detail) ? 'ink' : 'light'" :stroke="1.5" /><text>分享</text></view>
        <!-- #endif -->
        <!-- 联系发帖人直接打开作者会话；转发给其他人仍走分享菜单。 -->
        <view v-if="privateChatEnabled && !detail.author?.isMe" class="actbar__item" :class="{ 'actbar__item--off': !detailOpen }" hover-class="k-press" @click="messageAuthor"><k-icon name="send" :size="24" :color="detailOpen ? 'ink' : 'light'" :stroke="1.5" /><text>私信作者</text></view>
        <view class="actbar__safe" />
        <view class="k-home-indicator" />
      </view>
    </template>

    <!-- 4 评论互动 -->
    <template v-else-if="s === 4">
      <k-topbar :title="commentTitle" back custom-back @back="s = 3" />
      <view class="k-tabs k-tabs--left ctabs">
        <view v-for="t in ['热评', '最新']" :key="t" class="k-tabs__item" :class="{ active: ctab === t }" hover-class="k-press" @click="setCtab(t)"><text>{{ t }}</text></view>
      </view>
      <view class="comments" :style="{paddingBottom: `calc(${272 + (commentImages.length ? 82 : 0) + (replyTo ? 36 : 0) + (commentEmojis ? 112 : 0) + (commentError ? 80 : 0)}px + env(safe-area-inset-bottom))`}">
        <view v-for="cmt in comments" :key="cmt.commentId" class="comment">
          <view class="k-row-start k-gap10">
            <image class="comment__avatar" :class="{'member-frame':cmt.member?.frame}" :src="cmt.avatar" mode="aspectFill" @click="openUser(cmt.userId)" />
            <view class="k-flex1">
              <view class="k-between">
                <view class="k-row k-gap6 who who--grow"><text class="comment__name" @click="openUser(cmt.userId)">{{ cmt.name }}</text><member-mark :member="cmt.member" /><k-chip v-for="t in cmt.chips" :key="t" :tone="t === '行程已验证' ? 'green' : 'ochre'">{{ t }}</k-chip><text class="k-meta">{{ cmt.date }}</text></view>
                <view class="k-row k-gap4" hover-class="k-press" @click="likeComment(cmt)"><text class="comment__likes">{{ cmt.likes }}</text><k-icon name="thumbs-up" :size="18" :color="cmt.liked ? 'red' : 'ink'" :stroke="1.5" /></view>
              </view>
              <k-display-text class="comment__text k-pre" :class="{'member-highlight':cmt.member?.highlight}" :value="cmt.text" :preserve="[cmt.name]" />
              <comment-images :images="cmt.images || []" />
              <text class="comment__reply" @click="onReply(cmt)">{{ cmt.isMe ? '回复 · 管理' : '回复' }}</text>
              <view v-for="reply in (expandedReplies[cmt.commentId] ? cmt.replies : cmt.replies.slice(0,1))" :key="reply.commentId" class="comment__nest">
                <view class="k-between">
                  <view class="k-row k-gap6 who who--grow"><view v-if="reply.isAuthor" class="author"><text>作者</text></view><text class="comment__name" @click="openUser(reply.userId)">{{ reply.name }}</text><member-mark :member="reply.member" /><k-chip v-if="reply.phoneVerified" tone="ochre">手机已验证</k-chip><k-chip v-if="reply.tripVerified" tone="green">行程已验证</k-chip><text class="k-meta">{{ reply.dateText }}</text></view>
                  <view class="k-row k-gap4" hover-class="k-press" @click="likeComment(reply)"><text class="comment__likes">{{ reply.likes }}</text><k-icon name="thumbs-up" :size="18" :color="reply.liked ? 'red' : 'ink'" :stroke="1.5" /></view>
                </view>
                <k-display-text class="comment__text k-pre" :class="{'member-highlight':reply.member?.highlight}" :value="reply.text" :preserve="[reply.name, cmt.name]" />
                <comment-images :images="reply.images || []" />
                <text class="comment__reply" @click="onReply(reply)">回复</text>
              </view>
              <view v-if="cmt.more && !expandedReplies[cmt.commentId]" class="k-row k-gap4 k-mt8 comment__more" hover-class="k-press" @click="expandedReplies[cmt.commentId] = true"><text>展开 {{ cmt.more }} 条回复</text><k-icon name="chevron-down" :size="14" color="indigo" /></view>
            </view>
          </view>
        </view>
        <view v-if="cmLoaded && !comments.length" class="feed-empty"><text class="k-meta">还没有评论，来说第一句吧</text></view>
      </view>
      <view class="cbar">
        <!-- 2026-10-17：帖子没发布（审核中 / 没通过）时不给输入框，换成一行灰字（服务端同样 409） -->
        <view v-if="!detailOpen" class="cbar__off"><k-icon name="clock" :size="15" color="muted" :stroke="1.8" /><text>审核通过后才能点赞、收藏和评论</text></view>
        <view v-if="replyTo" class="comment-reply-target"><text>回复 {{ replyTo.name }}</text><button :disabled="commentBusy" @click="replyTo=null">取消回复</button></view>
        <view v-if="commentImages.length" class="comment-draft-images"><view v-for="(url,i) in commentImages" :key="url"><image :src="absUrl(url)" mode="aspectFill" @click="previewCommentDraft(i)"/><button :disabled="commentBusy" :aria-label="'移除第'+(i+1)+'张图片'" @click="commentImages.splice(i,1)">×</button></view></view>
        <view v-if="detailOpen" class="k-row k-gap10">
          <view class="k-input k-flex1 cbar__input"><input v-model="draft" :disabled="commentBusy" :placeholder="replyTo ? '回复 ' + replyTo.name : '友善评论，从心开始'" placeholder-class="k-placeholder" maxlength="500" @focus="commentEmojis=false" /></view>
          <button :disabled="commentBusy" class="comment-emoji-toggle" aria-label="评论表情" @click="toggleCommentEmojis"><k-icon name="smile" :size="24" /></button>
          <button class="cbar__send" :disabled="commentBusy || (!draft.trim() && !commentImages.length)" @click="sendComment()">{{ commentUploading ? '上传中' : sending ? '发送中' : '发送' }}</button>
        </view>
        <view v-if="detailOpen" class="comment-attachments">
          <button class="comment-image-toggle" :disabled="commentBusy || commentImages.length >= 3" aria-label="添加评论图片" @click="addCommentImages"><k-icon name="image" :size="20" /><text>{{ commentUploading ? '上传中…' : '添加图片' }}</text></button>
          <text>{{ commentImages.length }}/3 张 · 可以只发图片</text>
        </view>
        <text v-if="commentError && detailOpen" class="comment-error" role="alert">{{ commentError }}</text>
        <view v-if="commentEmojis && detailOpen" class="comment-emojis"><button v-for="emoji in commentEmojiList" :key="emoji" @click="draft.length + emoji.length <= 500 && (draft += emoji)">{{emoji}}</button></view>
        <view class="k-center-box k-gap16 k-mt12">
          <view class="cbar__ghost" hover-class="k-press" @click="reportPost"><text>举报</text></view>
          <view class="cbar__ghost" hover-class="k-press" @click="blockAuthor"><text>屏蔽该用户</text></view>
        </view>
        <view class="cbar__notice"><k-icon name="sprout" :size="16" color="green" :stroke="1.8" /><text>友善社区，温暖同行。请尊重每一位伙伴～</text><k-icon name="sprout" :size="16" color="green" :stroke="1.8" /></view>
        <view class="cbar__safe" />
        <view class="k-home-indicator" />
      </view>
    </template>
  </view>

  </k-community-gate>
</template>

<script setup>
import { privateChatEnabled } from '@/common/features.js'
import { wishEnabled } from '@/common/features.js'
import { publicShare, shareWithCover, timelineShare, showPublicShareMenu } from '@/common/public-share.js'
import { removeCommunityPost } from './remove-post.js'
import MemberMark from './components/member-mark.vue'
import { displayWording } from '@/common/display-wording.js'
import { selectCity } from '@/common/city-picker.js'
// ---------------------------------------------------------------------------
// 社区（用户端）接入情况：
//   s=1 同城信息流（2026-10-16 改版，对照主人样稿 21）：
//       顶栏「袋鼠小院」+ 袋鼠贴纸 + 城市；白色搜索条（直接打字，点右边圆形按钮或键盘「搜索」就搜标题 / 正文 / 话题；活动搜不到，提示字不写「活动」）；
//       页签 全部 / 找搭子 / 旅居日常（= 原「旅居日常」，后端代码还是 daily）/ 经验分享（= 原「换工日记」，后端代码还是 diary），右边小小的「最新 ▾」（最新 / 热门 / 已关注）；
//       经验分享下面一行小字 全部 / 换宿旅行 / 线下兼职 / 全职（apiFeed 的 jobType）；
//       找搭子留在本页（不再跳到单独一屏）：分类小字 +「筛选」（出发日期 / 同行天数 / 同行性别 / 只看已验证）+ 出行安全须知 + apiBuddies 列表；
//       卡片按数据排（community-feed.js buildBlocks）：第一条带图的是大图卡，挨着的两张带图的一行两列，落单的右边小图，没图的是文字卡（不拿占位图凑）；
//       卡片标题是「话题｜标题」（服务端 topicLabel；话题是「其他」时只显示标题）；本周热门活动做成带「去看看」的大图卡，插在「全部」的信息流里。
//       2026-10-17：帖子关联了 小院 / 门店、岗位 或 活动（服务端 link）时，卡片和详情里多一行「关联：XXX」，点了直接打开（post-link.js linkRoute）。
//       2026-10-11 内测建议：点作者头像 / 名字进 TA 的个人主页（R.userProfile）；「已关注」只看我关注的人（不分城市）；
//       「分享」小程序里是 open-type=share 按钮，一点打开微信转发面板，转发卡片带帖子标题和 ?postId=；详情页另有「私信」= 分享到私信
//   找搭子：「发起认识一下」= 打开与发帖人的私信（帖子限定了性别时服务端校验发起人资料里的性别）；「出行安全须知」= apiCommunityRules('buddy') 全文。
//       以前的单独一屏（?s=2）进来直接落到「找搭子」页签
//   s=3 帖子详情：apiPost（点赞 / 收藏 / 关注 / 关联推荐都是真实数据）
//   s=4 评论：apiPostComments（热评 / 最新）、发表 / 回复 / 点赞 / 删除自己的、举报、屏蔽该用户
// 城市：信息流、找搭子、活动页共用「社区城市」，上次选的记在本机（communityCity / saveCommunityCity），不跟首页定位城市走。
//   2026-10-19：选的城市某个页签一条都没有时自动看全国的（列表上面一行小字 +「只看X」；记住的城市不改，见 community-feed.js shouldWiden）。
// 身份标签只展示可验证的事实：「手机已验证」「行程已验证」；本期没有实名认证，不出现"实名"。
// ---------------------------------------------------------------------------
import { ref, computed, watch } from 'vue'
import { onShareAppMessage, onShow, onHide, onUnload, onReachBottom, onPullDownRefresh, onShareTimeline } from '@dcloudio/uni-app'
import { useScreen, go, back, toast } from '@/common/screen.js'
import {
  apiFeed, apiBuddies, apiPost, apiPostComments, apiPostComment, apiCommentLike, apiCommentDelete, apiPostLike,
  apiPostFavorite, apiFollow, apiBlock, apiReport, apiChatOpen, apiCommunityRules, apiChatRecent, apiChatSend
} from '@/common/api.js'
import { ensureSession, experience } from '@/common/experience.js'
import { sheet, prompt, confirm, alert, modal, shiftDate, todayCn } from '@/common/ui.js'
import { gated, fail, communityCity, saveCommunityCity } from '@/common/community.js'
import { sharePostText, postPath } from '@/common/post-share.js'
import { absUrl, uploadTo } from '@/common/upload.js'
import { chooseCommentImages } from './comment-upload.js'
import CommentImages from './components/comment-images.vue'
import R from '@/common/routes.js'
import { FEED_TABS, FEED_KIND, BUDDY_TAB, DIARY_TAB, JOB_CHIPS, BUDDY_CATS, CAT_KEY, catIcon, shortDate, titleOf, buildBlocks, postTags, canShare, canInteract, INTERACT_TIP, cityLabel, kindOf, KIND_COLOR, ALL_CITIES, shouldWiden, widenNotice } from './community-feed.js'
import { linkView } from './post-link.js'

const commentEmojis=ref(false)
function toggleCommentEmojis(){ commentEmojis.value=!commentEmojis.value; uni.hideKeyboard() }
const commentEmojiList=['😀','😊','😂','🥳','🤔','🥰','😎','😭','👍','👏','🙏','❤️','🎉','🌻','☕','✅']
const DEFAULT_AVATAR = '/static/media/profile-avatar.jpg'
let fromMine = false
let nationwide = false
const s = useScreen(4, {
  onLoad: async (q) => {
    // 从「我的发布」、个人主页、我的收藏点进来的（from=mine / user / fav）：返回就回原来的页面，不落到信息流
    fromMine = ['mine', 'user', 'fav'].includes(q?.from)
    // 找搭子以前是单独的一屏（?s=2）：现在是信息流的「找搭子」页签
    if (s.value === 2) { s.value = 1; feedTab.value = BUDDY_TAB }
    await ensureSession()
    // 冷启动直接进社区时，页面建起来那一刻账号还没恢复、读到的是游客那份；登录态恢复后按本账号再读一次上次选的城市
    city.value = '全部城市'
    // 「我的 → 全国攻略」进来（?tab=guide&all=1）：直接看全国的旅居日常；只在这次浏览里看全部城市，不改记住的社区城市
    if (q?.tab === 'guide') feedTab.value = '旅居日常'
    nationwide = q?.all === '1'
    if (nationwide) city.value = '全部城市'
    const id = Number(q?.postId) || 0
    // 之前帖子打不开（已删除 / 已隐藏 / 审核未通过）就直接 return，页面停在一片空白的信息流；现在打不开照常加载信息流
    if (id && await openPost(id, q.view === 'comments' ? 4 : 3)) return
    if (id && fromMine) return back()
    reload()
  }
})
// 之前从「发布」回来信息流不刷新，刚发的动态（审核中仅自己可见）要退出重进才看得到；现在回到信息流时重新拉第一页（找搭子页签重拉找搭子）
let shownOnce = false
onShow(() => {
  if (shownOnce) {
    // 之前在活动页换了城市再回来，这里还停在旧城市；现在和记住的社区城市对齐
    if (nationwide) city.value = '全部城市'
    if (s.value === 1) reload()
    if (s.value === 4) loadComments()
  }
  shownOnce = true
})
// 之前信息流只拉第一页 20 条、没有加载更多，更早的动态翻不到；现在滑到底按服务端 hasMore 继续加载（找搭子一次最多 50 条，不翻页）
onReachBottom(() => { if (s.value === 1 && feedTab.value !== BUDDY_TAB && feed.value.hasMore) loadFeed(true) })
const reload = () => (feedTab.value === BUDDY_TAB ? loadBuddies() : loadFeed())
// 下拉刷新（反馈 2.0：之前社区首页没有下拉刷新，新内容要退出重进才看得到）：
// 信息流这一屏重拉当前页签（找搭子页签拉找搭子），帖子详情重拉帖子，评论屏重拉评论；
// 找搭子的筛选弹层或日期弹层开着时直接收起刷新圈，不在弹层后面换数据
onPullDownRefresh(() => {
  if (filterOpen.value || dateOpen.value) { uni.stopPullDownRefresh(); return }
  const job = s.value === 1 ? reload() : s.value === 3 ? refreshPost() : s.value === 4 ? loadComments() : null
  Promise.resolve(job).finally(() => uni.stopPullDownRefresh())
})
function leavePost() {
  if (fromMine) return back()
  s.value = 1
  reload()
}
// 之前每次进社区都从兴趣城市第一位（首页会把定位城市放在那）起步，选过的城市（包括「全部城市」）回来就没了；
// 现在信息流和找搭子共用这一个城市，选了就记在本机，下次打开还是它
const city = ref('全部城市')
// 320 宽的手机上「全部城市」在顶栏只剩「全部…」：窄屏显示「全部」（选的值、发给服务端的还是「全部城市」）
let winW = 375
try { winW = uni.getSystemInfoSync().windowWidth || 375 } catch (e) { winW = 375 }
const cityText = computed(() => cityLabel(city.value, winW < 360))
async function pickCity() {
  const value = await selectCity({ value: city.value === '全部城市' ? '' : city.value, allowAll: true })
  if (value === null) return
  city.value = value || '全部城市'
  saveCommunityCity(city.value)
  // 重新选了城市：之前点过的「只看X」不再算（新城市空着时照样先看全国的）
  cityOnly.value = ''
  reload()
}

// ---------------- s=1 信息流 ----------------
const feedTab = ref('全部')
// 换页签 / 小字 / 排序 / 搜索时先清掉上一份结果：之前切页签那一下还显示着别的页签的动态
function resetFeed() {
  feed.value = { rows: [], hots: feed.value.hots || [] }
  feedLoaded.value = false
  feedFailed.value = false
}
const onFeedTab = (t) => {
  sortOpen.value = false
  if (feedTab.value !== t && t !== BUDDY_TAB) resetFeed()
  feedTab.value = t
  reload()
}
// 经验分享下面的小字：按关联经历的岗位类型筛（'' = 全部）
const jobType = ref('')
function setJobType(key) {
  jobType.value = jobType.value === key ? '' : key
  resetFeed()
  loadFeed()
}
// 之前只有 最新 / 热门 两种来回切；后来点一下弹出系统菜单，多一个「已关注」（只看我关注的人发的，服务端 sort=follow）。
// 2026-10-17 主人：右边改成「筛选」按钮，点开是页签行下面右对齐的小下拉（不再是底部系统菜单），当前那项打勾；点空白处收起
const SORTS = [{ key: 'new', label: '最新' }, { key: 'hot', label: '热门' }, { key: 'recommend', label: '推荐' }]
const sort = ref('new')
const sortOpen = ref(false)
const signedIn = computed(() => !!experience.account)
function toggleSort() { sortOpen.value = !sortOpen.value }
function pickSort(key) {
  sortOpen.value = false
  if (key === sort.value) return
  sort.value = key
  resetFeed()
  loadFeed()
}
// 搜索：keyword 是正在生效的关键词，kwDraft 是输入框里的字；在「找搭子」页签下搜的是找搭子
const keyword = ref('')
const kwDraft = ref('')
function runSearch() {
  const v = String(kwDraft.value || '').trim().slice(0, 30)
  kwDraft.value = v
  try { uni.hideKeyboard() } catch (e) { /* 没有键盘可收 */ }
  keyword.value = v
  if (feedTab.value !== BUDDY_TAB) resetFeed()
  reload()
}
function clearSearch() {
  kwDraft.value = ''
  if (!keyword.value) return
  keyword.value = ''
  if (feedTab.value !== BUDDY_TAB) resetFeed()
  reload()
}
const feed = ref({ rows: [], hots: [] })
const feedLoaded = ref(false)
const feedFailed = ref(false)
let feedSeq = 0
let feedPage = 1
// 选的城市空着时自动看全国（community-feed.js shouldWiden）：feedWide / buddyWide = 现在列表里是全国的；
// cityOnly = 点过「只看X」的那个城市（这个城市不再自动看全国；换了城市就不算了）
const feedWide = ref(false)
const buddyWide = ref(false)
const cityOnly = ref('')
const wideNow = computed(() => (feedTab.value === BUDDY_TAB ? buddyWide.value : feedWide.value))
const wideText = computed(() => widenNotice(city.value, feedTab.value, feedTab.value === BUDDY_TAB && (cat.value !== '全部' || !!activeFilters.value.length)))
// 「只看X」：回到只看这个城市（空着就是原来的空状态，下面多一个「看看全国的」）；「看看全国的」：回到自动看全国
const onlyThisCity = () => { cityOnly.value = city.value; if (feedTab.value !== BUDDY_TAB) resetFeed(); reload() }
const seeNationwide = () => { cityOnly.value = ''; if (feedTab.value !== BUDDY_TAB) resetFeed(); reload() }
const canWiden = computed(() => cityOnly.value === city.value && city.value !== ALL_CITIES && !keyword.value && (feedTab.value === BUDDY_TAB || sort.value !== 'follow'))
async function loadFeed(more) {
  // 切城市 / 页签 / 回到页面会连着发请求：只认最后一次，慢的旧请求不能把新结果盖掉
  const seq = ++feedSeq
  const page = more ? feedPage + 1 : 1
  if (!more) feedFailed.value = false
  // 正在自动看全国（feedWide）时，往下翻也接着翻全国的
  const params = { kind: FEED_KIND[feedTab.value] || undefined, city: more && feedWide.value ? ALL_CITIES : city.value, sort: sort.value, keyword: keyword.value || undefined, page }
  if (feedTab.value === DIARY_TAB && jobType.value) params.jobType = jobType.value
  try {
    let res = (await apiFeed(params)).data
    if (seq !== feedSeq || !res) return
    let wide = more ? feedWide.value : false
    // 2026-10-19：选的城市这个页签一条都没有（没在搜索、不是「已关注」）→ 再取全国的第一页（shouldWiden）；
    // 全国也没有、或这一次没取到，就照常显示这个城市的空状态
    if (!more && shouldWiden({ city: city.value, keyword: keyword.value, sort: sort.value, rows: res.rows, cityOnly: cityOnly.value })) {
      const all = await apiFeed({ ...params, city: ALL_CITIES }).then(r => r && r.data, () => null)
      if (seq !== feedSeq) return
      if (all && (all.rows || []).length) { res = all; wide = true }
    }
    if (more) {
      const seen = new Set((feed.value.rows || []).map(x => x.postId))
      feed.value = { ...feed.value, rows: [...(feed.value.rows || []), ...(res.rows || []).filter(x => !seen.has(x.postId))], hasMore: res.hasMore }
    } else feed.value = res
    feedWide.value = wide
    feedPage = page
    feedLoaded.value = true
  } catch (e) {
    if (seq === feedSeq) { fail(e, '社区加载失败'); if (!more) feedFailed.value = true }
  }
}
const hots = computed(() => (feed.value.hots || []).map(h => ({
  activityId: h.activityId, title: h.title, date: h.dateText, top: h.top, img: h.img ? absUrl(h.img) : '',
  metaText: [h.priceText, (h.count || 0) + '人报名'].filter(Boolean).join(' · ')
})))
const view = (p) => ({
  ...p, name: p.author.name, avatar: p.author.avatar ? absUrl(p.author.avatar) : DEFAULT_AVATAR,
  phone: p.author.phoneVerified, verified: p.author.tripVerified, followed: p.author.followed, isMe: p.author.isMe,
  titleText: displayWording(titleOf(p), [p.author?.name]), imgs: (p.images || []).map(absUrl), imgCount: (p.images || []).length, tags: postTags(p), link: linkView(p.link),
  // 2026-10-18 杂志感卡片：类型小字 + 类型色（kd-buddy / kd-daily / kd-diary）；城市只在和顶栏城市不一样时写（全部城市、已关注时有用）
  // 引号图标画在 SVG 里读不到 CSS 变量，类型色另给一份十六进制（KIND_COLOR，和样式里的 --kc 一致）
  kindKey: kindOf(p).key, kindText: kindOf(p).label, kindColor: KIND_COLOR[kindOf(p).key], place: p.city && p.city !== city.value ? p.city : ''
})
// 点「关联：XXX」：打开关联的小院 / 门店 / 岗位 / 活动（地址按类型拼，见 post-link.js）
const openLink = (l) => { if (l && l.to) go(l.to) }
const posts = computed(() => (feed.value.rows || []).map(view))
// 本周热门活动只插在「全部」里（没在搜索、不是「已关注」时）：活动搜不到，也不是关注的人发的
const showActs = computed(() => feedTab.value === '全部' && !keyword.value && sort.value !== 'follow')
const blocks = computed(() => buildBlocks(posts.value, showActs.value ? hots.value : []))
const openActivity = (h) => go(R.activity + '?id=' + h.activityId + '&channel=community')
const jobLabel = computed(() => JOB_CHIPS.find(j => j.key === jobType.value)?.label || '全部')
const emptyTitle = computed(() => {
  if (keyword.value) return '没有搜到相关动态'
  if (feedTab.value === DIARY_TAB) return jobType.value ? `还没有${jobLabel.value}的经验分享` : '还没有经验分享'
  if (feedTab.value === '旅居日常') return '这里还没有旅居日常'
  return '这里还没有动态'
})
const emptySub = computed(() => {
  if (keyword.value) return '换个关键词试试'
  if (feedTab.value === DIARY_TAB) return '做完一段换宿、兼职或全职后，点底部「发布」选「经验分享」，写下你的经历'
  return '换个城市看看，或点底部「发布」分享你的旅居日常'
})
// 经验分享空着时：去找对应类型的机会（带上社区城市）
// 2026-10-17 主人反馈「默认我在的位置也加到里面了」：社区城市多半是定位来的，进岗位列表不再带城市，和首页入口一样默认全部城市
const goJobs = () => go(R.jobsList + '?type=' + (jobType.value || 'volunteer'))

async function toggleFollow(p) {
  try {
    const res = await gated(() => apiFollow(p.author.userId))
    p.author.followed = res.data.followed
    ;(feed.value.rows || []).forEach(x => { if (x.author.userId === p.author.userId) x.author.followed = res.data.followed })
    if (detail.value.author && detail.value.author.userId === p.author.userId) detail.value.author.followed = res.data.followed
    toast(res.data.followed ? '已关注' : '已取消关注')
  } catch (e) {
    fail(e, '操作失败')
  }
}
async function likePost(p) {
  // 2026-10-17：没发布的帖子不能新点赞（之前点过的照常能取消）
  if (!canInteract(p) && !p.liked) return toast(INTERACT_TIP)
  try {
    const res = (await apiPostLike(p.postId)).data
    const hit = (feed.value.rows || []).find(x => x.postId === p.postId)
    if (hit) Object.assign(hit, { liked: res.liked, likes: res.likes })
    if (detail.value.postId === p.postId) Object.assign(detail.value, { liked: res.liked, likes: res.likes })
  } catch (e) {
    fail(e, '操作失败')
  }
}

// ---------------- 找搭子（信息流的一个页签） ----------------
// 分类按运营要的六类（和服务端分类一一对应），关键词对不上的帖子归「其他」
const cats = BUDDY_CATS
const cat = ref('全部')
const setCat = (c) => { cat.value = c; loadBuddies() }
const ACTIVITY_PHASES=[{key:'',label:'不限'},{key:'open',label:'正在报名'},{key:'ongoing',label:'进行中'},{key:'ended',label:'已结束'}]
const EMPTY_FILTER = () => ({ date: '', days: '', verified: false, gender: '',activityPhase:'' })
const bq = ref(EMPTY_FILTER())
// 同行性别筛选：「女生可参加」= 不限性别的 + 仅限女生的（服务端 gender 参数），男生同理
const GENDER_FILTERS = [{ label: '不限', key: '' }, { label: '女生可参加', key: 'female' }, { label: '男生可参加', key: 'male' }]
const DAY_FILTERS = [{ label: '不限', key: '' }, { label: '半天', key: '半天' }, { label: '1天', key: '1天' }, { label: '2-3天', key: '2-3天' }, { label: '一周以上', key: '一周以上' }]
const mdText = (ymd) => (ymd ? ymd.slice(5).replace('-', '/') : '')
const activeFilters = computed(() => {
  const f = bq.value
  const out = []
  if(f.activityPhase)out.push({key:'activityPhase',label:ACTIVITY_PHASES.find(x=>x.key===f.activityPhase)?.label||''})
  if (f.date) out.push({ key: 'date', label: mdText(f.date) + ' 出发' })
  if (f.days) out.push({ key: 'days', label: '同行' + f.days })
  if (f.gender) out.push({ key: 'gender', label: (GENDER_FILTERS.find(g => g.key === f.gender) || GENDER_FILTERS[0]).label })
  if (f.verified) out.push({ key: 'verified', label: '只看已验证' })
  return out
})
const clearFilter = (key) => { bq.value = { ...bq.value, [key]: key === 'verified' ? false : '' }; loadBuddies() }
// 「筛选」面板：改的是一份草稿 fd，点「确定」才生效；「重置」只清草稿
const filterOpen = ref(false)
const fd = ref(EMPTY_FILTER())
const openFilter = () => { fd.value = { ...bq.value }; filterOpen.value = true }
const resetFilter = () => { fd.value = EMPTY_FILTER() }
function applyFilter() {
  bq.value = { ...fd.value }
  filterOpen.value = false
  loadBuddies()
}
// H5 锁页面滚动（同岗位列表的 lockPageScroll）：小程序靠顶上的 page-meta；H5 没有它（H5 的 page-meta 关掉后清不掉样式，顶栏会从此不吸顶），
// 「筛选」弹层开着时自己给 body 写 overflow: hidden（传给整个视口，后面的搭子列表滑不动、停在原处），关掉、离开本页时原样还原，回来时弹层还开着就再锁上。
// 只锁 body、不碰 html：html 一写 hidden，body 就自己变成一屏高的滚动框，页面跳回顶上。弹层自己超高时照常在弹层里滚。
// 之前 H5 上在弹层上滑（比如在「同行天数」上往上拖），后面的搭子列表跟着动；鼠标滚轮在遮罩上也能滚动页面
let pageShown = false
let restoreScroll = null
function lockPageScroll(on) {
  // #ifdef H5
  if (typeof document === 'undefined') return
  if (on && !restoreScroll) {
    const body = document.body
    const before = body.style.overflow
    body.style.overflow = 'hidden'
    restoreScroll = () => { body.style.overflow = before }
  } else if (!on && restoreScroll) {
    restoreScroll()
    restoreScroll = null
  }
  // #endif
}
// 弹层只画在信息流这一屏（s=1）里
const sheetShown = () => filterOpen.value && s.value === 1
watch(sheetShown, (open) => { if (pageShown) lockPageScroll(open) })
onShow(() => { pageShown = true; lockPageScroll(sheetShown()) })
onHide(() => { pageShown = false; sortOpen.value = false; lockPageScroll(false) })
onUnload(() => lockPageScroll(false))
const explainTrip = () => alert('行程已验证','发布者在该城市有已确认的住宿订单、岗位报名或活动报名，由系统根据订单记录判断。')
// 出发日期用日历点选（两周内）
const dateOpen = ref(false)
const pickFilterDate = () => { dateOpen.value = true }
function confirmDate(date) {
  dateOpen.value = false
  fd.value.date = date || ''
}
const buddies = ref({ rows: [] })
const buddiesLoaded = ref(false)
const buddiesFailed = ref(false)
let buddySeq = 0
async function loadBuddies() {
  const seq = ++buddySeq
  buddiesFailed.value = false
  const q = { city: city.value, date: bq.value.date || undefined, days: bq.value.days || undefined,
    category: CAT_KEY[cat.value], activityPhase:bq.value.activityPhase||undefined, verified: bq.value.verified, gender: bq.value.gender || undefined, keyword: keyword.value || undefined }
  try {
    let res = (await apiBuddies(q)).data
    if (seq !== buddySeq) return
    // 2026-10-19：选的城市一个找搭子都没有（没在搜索）→ 同样的分类、筛选条件再看全国的（见 loadFeed）
    let wide = false
    if (res && shouldWiden({ city: city.value, keyword: keyword.value, rows: res.rows, cityOnly: cityOnly.value })) {
      const all = await apiBuddies({ ...q, city: ALL_CITIES }).then(r => r && r.data, () => null)
      if (seq !== buddySeq) return
      if (all && (all.rows || []).length) { res = all; wide = true }
    }
    buddies.value = res || buddies.value
    buddyWide.value = wide
    buddiesLoaded.value = true
  } catch (e) {
    if (seq === buddySeq) { fail(e, '加载失败'); buddiesFailed.value = true }
  }
}
const mates = computed(() => (buddies.value.rows || []).map((m) => ({
  ...m, time: m.timeText, img: m.images && m.images[0] ? absUrl(m.images[0]) : '',
  icon: catIcon(m.categoryLabel), day: shortDate(m.timeText),
  daysText: m.days && m.days !== '待定' ? '同行' + m.days : '同行天数待定',
  avatar: m.author && m.author.avatar ? absUrl(m.author.avatar) : DEFAULT_AVATAR,
  avatars: (m.avatars || []).map(absUrl)
})))
// 连点「发起认识一下」会连开两个私信页
let meeting = false
function messageAuthor() {
  if (!privateChatEnabled.value || !detail.value.postId) return
  if (!detailOpen.value) return toast('动态审核通过后才能联系作者')
  return meet(detail.value)
}
async function meet(m) {
  if (m.author?.isMe) return go(m.activity?.isMine ? R.activityMine + '?id=' + m.activity.activityId : '/pages/community/mine')
  if (meeting) return
  meeting = true
  try {
    const res = await gated(() => apiChatOpen({ type: 'private', postId: m.postId }))
    go(R.chat + '?convId=' + res.data.convId)
  } catch (e) {
    // 帖子限定了同行性别、而我资料里还没填性别时服务端返回 422：直接给「去填写」，不只弹一句提示；性别不符（403）照常提示原因
    if (e && e.code === 422 && String(e.message || '').includes('个人资料')) {
      if ((await modal('先填写性别', e.message, { confirmText: '去填写' })).confirm) go(R.profile + '?s=2')
      return
    }
    fail(e, '暂时无法发起私信')
  } finally {
    meeting = false
  }
}
// 《找搭子安全须知》全文（游客也能看）：找搭子列表和找搭子帖详情里的「出行安全须知」
async function openBuddySafety() {
  try {
    const doc = (await apiCommunityRules('buddy')).data
    alert(doc.title, doc.content)
  } catch (e) {
    fail(e, '安全须知加载失败，请稍后再试')
  }
}

// ---------------- s=3 帖子详情 ----------------
const detail = ref({ author: {}, images: [], tags: [], related: [] })
const imgIdx = ref(0)
const heroImgs = computed(() => (detail.value.images || []).map(absUrl))
const heroImg = computed(() => heroImgs.value[0] || '/static/media/cover-empty.png')
const heroBadge = computed(() => `${Math.min(imgIdx.value, Math.max(0, heroImgs.value.length - 1)) + 1}/${Math.max(1, heroImgs.value.length)}`)
// 没图的帖子顶上的类型色条（2026-10-19，代替「暂无图片」占位图）：类型 key（套 kd-* 配色）、类型名、引号颜色（SVG 里读不到 CSS 变量）
const detailKindKey = computed(() => kindOf(detail.value).key)
const detailKindLabel = computed(() => kindOf(detail.value).label)
const detailKindColor = computed(() => KIND_COLOR[detailKindKey.value])
const previewHero = () => {
  const list = heroImgs.value
  if (list.length) uni.previewImage({ urls: list, current: list[imgIdx.value] || list[0] })
}
const detailLink = computed(() => linkView(detail.value.link))
const authorAvatar = computed(() => (detail.value.author && detail.value.author.avatar ? absUrl(detail.value.author.avatar) : DEFAULT_AVATAR))
async function openPost(id, screen) {
  try {
    detail.value = (await apiPost(id)).data
    imgIdx.value = 0
    // 2026-10-17：没发布的帖子没有评论区（不能评论），要进评论屏（?view=comments）的落到详情，正文下面有一行说明
    s.value = screen === 4 && !canInteract(detail.value) ? 3 : screen || 3
    if (s.value === 4) loadComments()
    return true
  } catch (e) {
    fail(e, '动态不存在或已被隐藏')
    return false
  }
}
// 帖子详情下拉刷新：原地重拉这条帖子（点赞数、评论数、审核状态），停在当前这一屏
async function refreshPost() {
  const id = detail.value.postId
  if (!id) return
  try {
    const d = (await apiPost(id)).data
    if (d && detail.value.postId === id) {
      detail.value = d
      imgIdx.value = Math.min(imgIdx.value, Math.max(0, (d.images || []).length - 1))
    }
  } catch (e) {
    fail(e, '动态不存在或已被隐藏')
  }
}
// 2026-10-17 主人反馈：审核中 / 没通过的帖子 赞 / 评论 / 收藏 都不能用（按钮灰掉，点了只提示；服务端 409 兜底）
const detailOpen = computed(() => canInteract(detail.value))
const openComments = () => { if (!detailOpen.value) return toast(INTERACT_TIP); s.value = 4; loadComments() }
// 信息流卡片上的「评论」：没发布的帖子只提示，不进评论屏
const openPostComments = (p) => (canInteract(p) ? openPost(p.postId, 4) : toast(INTERACT_TIP))
async function favoritePost() {
  // 没发布的帖子不能新收藏（之前收藏过的照常能取消）
  if (!detailOpen.value && !detail.value.favorited) return toast(INTERACT_TIP)
  try {
    const res = await gated(() => apiPostFavorite(detail.value.postId))
    detail.value.favorited = res.data.favorited
    toast(res.data.favorited ? '已收藏' : '已取消收藏')
  } catch (e) {
    fail(e, '操作失败')
  }
}

// ---------------- s=4 评论 ----------------
const ctab = ref('热评')
const setCtab = (t) => { ctab.value = t; loadComments() }
const draft = ref(''), commentImages = ref([]), replyTo = ref(null), expandedReplies = ref({})
const commentUploading = ref(false), sending = ref(false)
const commentError = ref('')
const commentBusy = computed(() => commentUploading.value || sending.value)
let composerVersion = 0
watch([() => detail.value.postId, () => experience.account?.id], () => { composerVersion++; draft.value=''; commentImages.value=[]; replyTo.value=null; expandedReplies.value={}; commentError.value='' })
const previewCommentDraft = i => uni.previewImage({urls:commentImages.value.map(absUrl),current:absUrl(commentImages.value[i])})
async function addCommentImages() {
  if (commentBusy.value || commentImages.value.length >= 3) return
  if (!experience.account) return go(R.login)
  const owner=experience.account.id, version=composerVersion
  commentUploading.value=true; commentEmojis.value=false; commentError.value=''
  try {
    const files=await chooseCommentImages(3-commentImages.value.length)
    for (const file of files.slice(0,3-commentImages.value.length)) {
      if (owner!==experience.account?.id || version!==composerVersion) return
      const res=await uploadTo('/app/upload/image',file)
      if (owner!==experience.account?.id || version!==composerVersion) return
      if (!res.data?.url) throw new Error('图片上传失败，请重试')
      commentImages.value.push(res.data.url)
    }
  } catch(e) {
    if (owner===experience.account?.id && version===composerVersion) {
      commentError.value=(e.message || '图片上传失败')+'。已添加的图片仍保留，可再次添加。'
      fail(e,'图片上传失败，请重试')
    }
  }
  finally { commentUploading.value=false }
}
const cm = ref({ rows: [], total: 0 })
const commentTitle = computed(() => `全部评论（${detail.value.comments || 0}）`)
const cmLoaded = ref(false)
async function loadComments() {
  try {
    const id=detail.value.postId
    const data=(await apiPostComments(id, ctab.value === '最新' ? 'new' : 'hot')).data
    if (id!==detail.value.postId) return
    cm.value=data || cm.value
    detail.value.comments=cm.value.total
    cmLoaded.value = true
  } catch (e) {
    fail(e, '评论加载失败')
  }
}
const deletingPost=ref(false)
async function deleteOwnPost(){if(deletingPost.value)return;deletingPost.value=true;try{if(await removeCommunityPost(detail.value)){leavePost();loadFeed()}}finally{deletingPost.value=false}}
const chipsOf = (c) => [c.phoneVerified ? '手机已验证' : '', c.tripVerified ? '行程已验证' : ''].filter(Boolean)
const comments = computed(() => (cm.value.rows || []).map(c => {
  const r = (c.replies || [])[0]
  return {
    ...c, avatar: c.avatar ? absUrl(c.avatar) : DEFAULT_AVATAR, chips: chipsOf(c), text: c.content + (c.pending ? '（审核中）' : ''), date: c.dateText,
    replies: (c.replies || []).map(r => ({ ...r, text: (r.content || '') + (r.pending ? '（审核中）' : '') })),
    more: Math.max(0, (c.replies || []).length - 1)
  }
}))
async function sendComment() {
  if (!detailOpen.value) return toast(INTERACT_TIP)
  if (commentBusy.value) return
  const text=draft.value.trim(), images=[...commentImages.value], parent=replyTo.value
  if (!text && !images.length) return toast('写点文字或添加图片吧')
  const id=detail.value.postId, owner=experience.account?.id, version=composerVersion
  sending.value=true; commentError.value=''
  try {
    const res=await gated(() => {
      if (owner!==experience.account?.id || version!==composerVersion) throw new Error('页面或账号已变化，请重新发送')
      return apiPostComment(id,text,parent?.commentId,images)
    })
    if (owner!==experience.account?.id || version!==composerVersion) return
    toast(res.data.message); draft.value=''; commentImages.value=[]; replyTo.value=null
    await loadComments()
  } catch(e) {
    if (owner===experience.account?.id && version===composerVersion && !e?.silent) {
      commentError.value=(e.message || '评论发送失败')+'。文字和图片已保留，请重试。'
      fail(e,'评论失败，内容已保留')
    }
  }
  finally { sending.value=false }
}
function startReply(c) { if (!commentBusy.value) {replyTo.value=c; commentEmojis.value=false} }
async function onReply(c) {
  if (!c.isMe) return startReply(c)
  const i = await sheet(['回复', '删除这条评论'])
  if (i === 0) startReply(c)
  if (i === 1 && (await confirm('删除评论', '删除后不可恢复，确认？'))) {
    try {
      toast((await apiCommentDelete(c.commentId)).msg || '已删除')
      // 之前删完标题「全部评论（N）」和详情页评论数都不变；现在和服务端一致：删的是已展示（非审核中）的评论才减 1
      if (!c.pending) detail.value.comments = Math.max(0, (detail.value.comments || 0) - 1)
      loadComments()
    } catch (e) {
      fail(e, '删除失败')
    }
  }
}
async function likeComment(c) {
  if (!detailOpen.value && !c.liked) return toast(INTERACT_TIP)
  try {
    await gated(() => apiCommentLike(c.commentId))
    loadComments()
  } catch (e) {
    fail(e, '操作失败')
  }
}

const REASONS = ['垃圾广告 / 引流', '色情低俗', '辱骂攻击', '诈骗或虚假信息', '泄露他人隐私', '其他']
async function reportPost() {
  const i = await sheet(REASONS)
  if (i < 0) return
  try {
    toast((await gated(() => apiReport('post', detail.value.postId, REASONS[i]))).msg)
  } catch (e) {
    fail(e, '举报失败')
  }
}
async function blockAuthor() {
  const a = detail.value.author || {}
  if (a.isMe) return toast('不能屏蔽自己')
  if (!(await confirm('屏蔽该用户', `屏蔽后你们互相看不到对方的动态与评论，也不能私信。确认屏蔽「${a.name}」？`))) return
  try {
    const res = await gated(() => apiBlock(a.userId))
    toast(res.data.blocked ? '已屏蔽' : '已取消屏蔽')
    if (res.data.blocked) { s.value = 1; reload() }
  } catch (e) {
    fail(e, '操作失败')
  }
}

// ---------------- 作者主页 / 分享 ----------------
// 点作者头像、名字：进 TA 的个人主页（资料、关注 / 私信、TA 的动态；举报和屏蔽在右上角「···」里）
const openUser = (uid) => { if (Number(uid)) go(R.userProfile + '?uid=' + Number(uid)) }

// 转发卡片：从「分享」按钮点的，按按钮上带的帖子编号找标题；从右上角「···」转发的，在详情里就转这条帖子，否则转社区首页
const pageShareMessage = (res) => {
  const fromBtn = Number(res && res.target && res.target.dataset && res.target.dataset.postId) || 0
  const id = fromBtn || (s.value >= 3 ? Number(detail.value.postId) || 0 : 0)
  if (!id) return { title: '袋鼠全球青年 · 同城社区', path: R.community }
  const hit = detail.value.postId === id ? detail.value : (feed.value.rows || []).find(x => x.postId === id)
  // 审核中的动态（从详情右上角「···」转发）别人打不开：转社区首页
  if (hit && !canShare(hit)) return { title: '袋鼠全球青年 · 同城社区', path: R.community }
  const cover = hit && hit.images && hit.images[0] ? absUrl(hit.images[0]) : undefined
  return { title: displayWording(hit && hit.title, [hit?.author?.name]) || '袋鼠全球青年 · 社区动态', path: postPath(id), ...(cover ? { imageUrl: cover } : {}) }
}

// H5 等非小程序环境没有微信转发面板：复制链接，或分享到私信
async function shareOther(p) {
  // 之前审核中的动态也能「复制链接」，别人点开是打不开的；现在和「分享到私信」一样先拦下
  if (!canShare(p)) return toast('动态审核通过后才能分享')
  const i = await sheet(privateChatEnabled.value ? ['复制链接', '分享到私信'] : ['复制链接'])
  if (i === 0) {
    let link = postPath(p.postId)
    // #ifdef H5
    link = window.location.href.split('#')[0] + '#' + postPath(p.postId)
    // #endif
    uni.setClipboardData({ data: (p.title ? p.title + ' ' : '') + link, success: () => toast('链接已复制，发给朋友打开就能看到') })
  }
  if (i === 1) shareToChat(p)
}

// 分享到私信：列出我最近的私信会话，选一个人发过去；对方回复前的条数限制、对方的「谁可以私信我」照常生效
async function shareToChat(p) {
  if(!privateChatEnabled.value)return toast('用户私信暂未开放')
  if (!p || !p.postId) return
  if (!canShare(p)) return toast('动态审核通过后才能分享')
  let list = []
  try {
    list = (await gated(() => apiChatRecent())).data || []
  } catch (e) {
    return fail(e, '私信列表加载失败')
  }
  if (!list.length) return alert('还没有私信', '你还没有和别人私信过。可以先在帖子作者的主页点「私信」聊起来，之后就能把动态分享给 TA。')
  const i = await sheet(list.map(c => (c.other && c.other.name) || '私信').slice(0, 30))
  if (i < 0 || !list[i]) return
  const text = sharePostText(p)
  if (!text) return
  const clientId = ('s' + Date.now().toString(36) + Math.random().toString(36).slice(2) + '0000000000000000').slice(0, 24)
  try {
    await apiChatSend(list[i].convId, text, clientId)
    toast('已分享给 ' + ((list[i].other && list[i].other.name) || '对方'))
  } catch (e) {
    fail(e, '分享失败')
  }
}

onShareAppMessage((event) => shareWithCover(pageShareMessage(event)))
onShareTimeline(() => timelineShare(pageShareMessage()))
onShow(showPublicShareMenu)
</script>

<style scoped lang="scss">
.post-owner-actions{display:flex;justify-content:flex-end;padding:0 16px}.post-owner-actions button{margin:0;padding:0 12px;background:var(--k-alert-soft);color:var(--k-alert);font-size:13px;line-height:36px;border-radius:18px;border:1px solid var(--k-line)}.post-owner-actions button:after{border:0}

.werewolf-entry { display: flex; align-items: center; gap: 12px; margin: 2px 0 18px; padding: 14px; border-radius: 16px; background: var(--k-green-soft); }
.werewolf-entry__icon { width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: var(--k-bg); }
.werewolf-entry__copy { flex: 1; min-width: 0; }
.werewolf-entry__title { display: block; font-size: 16px; font-weight: 600; color: var(--k-ink); }
.werewolf-entry__hint { display: block; font-size: 13px; color: var(--k-green); margin-top: 4px; }
.undercover-entry { background: var(--k-red-soft); }
.undercover-entry .werewolf-entry__hint { color: var(--k-red-deep); }
.community { --k-display-font: var(--k-sans); --k-brand: var(--k-sans); --k-bg: #FCF9F3; }
.brand { width: calc(100vw - 128px); display: flex; align-items: center; gap: 4px; min-width: 0; padding-left: 8px; }
.brand__name { flex: 0 0 auto; font-family: var(--k-sans); font-weight: 600; font-size: 20px; letter-spacing: .5px; color: var(--k-ink); white-space: nowrap; }
.brand__logo { flex: 0 0 auto; width: 20px; height: 22px; margin-left: 2px; }
.brand__city { min-width: 0; height: 44px; margin-left: 8px; display: flex; align-items: center; gap: 3px; font-size: 13px; font-weight: 400; color: var(--k-ink2); }
.brand__city-name { min-width: 0; max-width: 6em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
@media (max-width: 359px) {
  .brand { gap: 2px; padding-left: 4px; }
  .brand__name { font-size: 18px; letter-spacing: 0; }
  .brand__city { margin-left: 4px; gap: 2px; }
}
.search { margin: 12px 16px 2px; height: 48px; display: flex; align-items: center; gap: 8px; padding: 0 4px 0 14px; border: 1px solid #E8E2D9; border-radius: 14px; background: #F5F1EA; }
.search__input { flex: 1; min-width: 0; height: 46px; font-size: 14px; color: var(--k-ink); }
.search__clear { flex: 0 0 auto; width: 30px; height: 44px; display: flex; align-items: center; justify-content: center; }
.search__btn { flex: 0 0 auto; min-width: 48px; height: 46px; padding: 0 2px; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 500; color: var(--k-red-deep); }
.ftabs { height: 54px; margin: 0 16px; padding: 0; border-bottom: 1px solid #E8E2D9; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.ftabs__row { flex: 1; width: auto; height: 100%; min-width: 0; display: flex; align-items: stretch; justify-content: space-between; gap: 6px; }
.ftab { position: relative; flex: 0 0 auto; display: flex; align-items: center; font-size: 15px; font-weight: 400; color: var(--k-muted); white-space: nowrap; }
.ftab.on { color: var(--k-ink); font-weight: 600; }
.ftab.on::after { content: ""; position: absolute; left: 0; right: 0; bottom: -1px; height: 2px; border-radius: 1px; background: var(--k-red); }
.ftabs { position: relative; }
.fsort { flex: 0 0 auto; height: 32px; margin: -6px -6px -6px 0; padding: 6px 6px 6px 8px; box-sizing: content-box; display: flex; align-items: center; gap: 4px; font-size: 13px; color: var(--k-ink2); white-space: nowrap; }
.fsort.on { color: var(--k-orange-deep); font-weight: 600; }
.fmask { position: fixed; left: 0; top: 0; right: 0; bottom: 0; z-index: 60; background: rgba(58, 50, 43, .08); }
.fmenu { position: absolute; right: 0; top: 48px; z-index: 61; min-width: 132px; padding: 6px 0; border-radius: 14px; background: var(--k-paper); box-shadow: var(--k-sh3); }
.fmenu__item { display: flex; align-items: center; justify-content: space-between; gap: 16px; height: 48px; padding: 0 16px; font-size: 15px; color: var(--k-ink); white-space: nowrap; }
.fmenu__item + .fmenu__item { border-top: 1px solid var(--k-line); }
.fmenu__item.on { color: var(--k-red-deep); font-weight: 600; }
@media (max-width: 359px) {
  .ftabs { padding: 0; }
  .ftabs__row { gap: 4px; }
  .ftab { font-size: 14px; }
}
.feed { padding-left: 16px; padding-right: 16px; }
.subchips { display: flex; align-items: center; gap: 20px; padding: 0 16px 2px; }
.subchips .subchip { height: 44px; padding: 0; border-radius: 0; background: transparent; color: var(--k-ink2); font-size: 13px; }
.subchips .subchip.on { background: transparent; color: var(--k-red-deep); font-weight: 700; }
.subchip { flex: 0 0 auto; height: 30px; padding: 0 14px; border-radius: 999px; background: var(--k-paper2); color: var(--k-ink2); font-size: 13px; white-space: nowrap; display: flex; align-items: center; }
.subchip.on { background: var(--k-red); color: #fff; font-weight: 600; }
@media (max-width: 359px) {
  .subchip { padding: 0 12px; }
}
.kwline { margin-top: 10px; display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--k-ink2); }
.kwline__text { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.kwline__clear { flex: 0 0 auto; height: 28px; padding: 0 10px; border-radius: 999px; background: var(--k-paper2); color: var(--k-ink); display: flex; align-items: center; }
.wide-note { margin-top: 12px; padding: 8px 6px 8px 12px; border-radius: 14px; background: #FBF1E4; border: 1px solid var(--k-hair); display: flex; align-items: center; gap: 6px; font-size: 13px; line-height: 1.5; color: #74502F; }
.wide-note__text { flex: 1; min-width: 0; }
.wide-note__back { flex: 0 0 auto; height: 30px; padding: 0 4px 0 10px; border-left: 1px solid rgba(154, 107, 63, .18); display: flex; align-items: center; gap: 1px; color: var(--k-red-deep); font-weight: 600; }
.wide-note__city { max-width: 7em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.feed-loading { padding: 32px 0; text-align: center; font-size: 14px; color: var(--k-ink2); }
.feed-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 36px 16px; text-align: center; }
.feed-empty__title { font-family: var(--k-serif); font-weight: 700; font-size: 15px; }
.feed-empty__sub { font-size: 14px; line-height: 1.6; color: var(--k-ink2); }
.feed-empty__retry { height: 36px; margin-top: 4px; padding: 0 18px; border: 1px solid var(--k-red); border-radius: 999px; color: var(--k-red-deep); font-size: 14px; display: flex; align-items: center; }
.feed-end { padding: 20px 0 8px; text-align: center; font-size: 13px; color: var(--k-ink2); }
.who { flex-wrap: wrap; row-gap: 2px; min-width: 0; }
.who--grow { flex: 1; margin-right: 8px; }
.share-btn { margin: 0; padding: 0; background: transparent; border: 0; border-radius: 0; line-height: inherit; font-size: inherit; color: inherit; text-align: left; }
.share-btn::after { border: 0; }
.card { margin-top: 16px; border-radius: 16px; background: var(--k-paper); overflow: hidden; }
.blk { margin-top: 24px; }
.blk:first-of-type { margin-top: 16px; }
.fc, .fc-col, .fc-act { margin-top: 0; border-radius: 0; background: transparent; box-shadow: none; }
.fc, .fc-pair, .fc-act--wide { padding-bottom: 14px; border-bottom: 1px solid #E8E2D9; }
.img-count { position: absolute; right: 10px; bottom: 10px; height: 22px; padding: 0 7px; border-radius: 7px; background: rgba(58,50,43,.62); color: #FCF9F3; font-size: 11px; display: flex; align-items: center; gap: 4px; }
.kd-buddy { --kc: #4A6E3A; --kc-soft: #E6EEDC; --kc-soft2: #F3F7EE; }
.kd-daily { --kc: #8A5A1C; --kc-soft: #F4E7D0; --kc-soft2: #FAF4E9; }
.kd-diary { --kc: #94513B; --kc-soft: #F3E2DA; --kc-soft2: #FAF2EE; }
.kd-other { --kc: #8A5E36; --kc-soft: #F2E8DB; --kc-soft2: #FAF6F0; }
.kicker { display: flex; align-items: center; gap: 6px; min-width: 0; margin-bottom: 8px; font-size: 11px; line-height: 16px; }
.kicker__dot { flex: 0 0 auto; width: 14px; height: 3px; border-radius: 2px; background: var(--kc, var(--k-red)); }
.kicker__kind { flex: 0 0 auto; font-weight: 400; color: var(--kc, var(--k-muted)); }
.kicker__place { min-width: 0; color: var(--k-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.kicker__pin { flex: 0 0 auto; height: 16px; padding: 0 5px; border-radius: 4px; background: var(--k-red); color: #fff; font-size: 10px; font-weight: 700; line-height: 16px; }
.fc__media { position: relative; height: 0; padding-top: 64%; border-radius: 16px; overflow: hidden; background: var(--k-paper2); }
.fc__img { width: 100%; height: 100%; }
.fc__media-img { position: absolute; left: 0; top: 0; }
.fc__pin { position: absolute; left: 12px; top: 12px; height: 22px; padding: 0 9px; border-radius: 999px; background: rgba(255,255,255,.92); color: var(--k-red-deep); font-size: 11px; font-weight: 700; line-height: 22px; }
.fc__panel { padding: 16px 0 0; }
.fc--hero .fc__panel, .fc--lead .fc__panel { position: relative; margin-top: 0; border-radius: 0; background: transparent; }
.fc__band { padding: 0; background: transparent; }
.kicker--band { position: relative; margin: 0; }
.fc__who { display: flex; align-items: center; gap: 9px; min-height: 48px; margin-top: 12px; }
.fc__avatar { flex: 0 0 auto; width: 30px; height: 30px; border-radius: 50%; background: var(--k-paper2); }
.fc__meta { flex: 1; min-width: 0; }
.fc__name-row { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; row-gap: 2px; min-width: 0; }
.fc__name { max-width: 12em; font-weight: 500; font-size: 13px; color: var(--k-ink2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fc__date { display: block; font-size: 11px; line-height: 18px; color: var(--k-muted); }
.fc__submeta { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-top: 2px; }
.fc__verified { display: flex; align-items: center; gap: 3px; font-size: 10px; color: var(--k-muted); }
.fc__body { display: flex; align-items: flex-start; gap: 16px; margin-top: 0; }
.fc__copy { flex: 1; min-width: 0; }
.fc__title { font-family: var(--k-sans); display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; font-weight: 600; font-size: 18px; line-height: 1.5; color: var(--k-ink); word-break: break-all; }
.fc--hero .fc__title, .fc--lead .fc__title { font-size: 20px; line-height: 1.45; letter-spacing: .3px; }
.fc__text { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; margin-top: 8px; font-size: 14px; line-height: 1.7; color: var(--k-ink2); word-break: break-all; }
.fc--hero .fc__text { -webkit-line-clamp: 2; }
.fc--lead .fc__text { margin-top: 6px; -webkit-line-clamp: 3; }
.fc__excerpt { margin-top: 7px; }
.fc__text.fc__text--quote { margin-top: 0; }
.fc--thumb .fc__panel { padding: 0; }
.fc__thumb { position: relative; flex: 0 0 auto; width: 104px; height: 116px; border-radius: 16px; overflow: hidden; background: var(--k-paper2); }
.fc--thumb .follow, .fc--thumb .fc__date { display: none; }
.fc--thumb .fc__avatar { width: 30px; height: 30px; }
.fc--thumb .fc__who { gap: 8px; }
.fc--thumb .fc__body { margin-top: 0; }
.fc--thumb .fc__title { font-size: 17px; }
.fc--thumb .fc__text { -webkit-line-clamp: 1; }
.fc--thumb .fc__actions { margin-right: 0; gap: 8px; }
.fc--thumb .fc__act--share text { display: none; }
.fc__tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.fc__link { margin-top: 8px; height: 34px; padding: 0 10px; border-radius: 10px; background: #FBF4EA; display: flex; align-items: center; gap: 6px; }
.fc__link-tag { flex: 0 0 auto; height: 18px; padding: 0 6px; border-radius: 5px; background: var(--k-paper); color: var(--k-red-deep); font-size: 11px; font-weight: 600; line-height: 18px; }
.fc__link-title { min-width: 0; flex: 1; font-size: 13px; color: var(--k-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fc__actions { display: flex; align-items: center; justify-content: flex-start; gap: 24px; margin-top: 4px; }
.fc__act { min-height: 48px; min-width: 48px; display: flex; align-items: center; justify-content: flex-start; gap: 6px; font-size: 12px; font-weight: 400; color: var(--k-muted); }
.fc--hero .fc__actions, .fc--lead .fc__actions, .fc--text .fc__actions { justify-content: flex-start; gap: 24px; }
.follow { flex: 0 0 auto; height: 36px; padding: 0 16px; border: 1px solid var(--k-red-line); border-radius: 18px; color: var(--k-red-deep); font-size: 13px; font-weight: 500; display: flex; align-items: center; justify-content: center; }
.follow.on { border-color: transparent; background: var(--k-paper2); color: var(--k-muted); }
.fc .follow { height: 48px; padding: 0 4px 0 12px; border: 0; border-radius: 0; background: transparent; gap: 3px; color: var(--k-red-deep); }
.fc .follow.on { background: transparent; color: var(--k-muted); }
.fc__act--share { margin-left: auto; }
.follow--lg { height: 30px; padding: 0 16px; font-size: 14px; }
.fc-pair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-top: 0; }
.fc-pair__cell { min-width: 0; display: flex; }
.fc-pair__cell > .card { flex: 1; min-width: 0; margin-top: 0; }
.fc-col { display: flex; flex-direction: column; }
.fc-col__media { position: relative; height: 0; padding-top: 110%; border-radius: 16px; overflow: hidden; background: var(--k-paper2); }
.fc-col__img { position: absolute; left: 0; top: 0; width: 100%; height: 100%; }
.fc-col__cover { position: relative; padding: 0; }
.fc-col__cover .kicker { position: relative; margin-bottom: 8px; }
.fc-col__cover-title { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; font-weight: 600; font-size: 16px; line-height: 1.5; color: var(--k-ink); word-break: break-all; }
.fc-col__text { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; font-size: 14px; line-height: 1.65; color: var(--k-ink2); word-break: break-all; }
.fc-col__body { flex: 1; display: flex; flex-direction: column; padding: 12px 0 0; }
.fc-col__title { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; font-weight: 600; font-size: 16px; line-height: 1.55; color: var(--k-ink); word-break: break-all; }
.fc-col__link { margin-top: 6px; display: flex; align-items: center; gap: 3px; min-width: 0; }
.fc-col__link-text { min-width: 0; flex: 1; font-size: 12px; color: var(--k-red-deep); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fc-col__foot { margin-top: auto; padding-top: 10px; display: flex; flex-wrap: wrap; align-items: center; column-gap: 8px; font-size: 12px; color: var(--k-muted); }
.fc-col__who { flex: 0 0 100%; min-width: 0; display: flex; align-items: center; gap: 5px; min-height: 32px; }
.fc-col__avatar { flex: 0 0 auto; width: 22px; height: 22px; border-radius: 50%; background: var(--k-paper2); }
.fc-col__name { flex: 0 1 auto; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fc-col__stat { flex: 1 1 0; min-width: 0; min-height: 44px; display: flex; align-items: center; gap: 4px; }
.fc__act--off, .fc-col__stat--off { color: var(--k-light); }
.fc-col__tags { gap: 4px; margin-top: 6px; }
@media (max-width: 359px) {
  .fc-act__img { height: 140px; }
  .fc-pair { gap: 12px; }
}
.acts-more { display: flex; justify-content: flex-end; margin-top: 2px; }
.acts-more__link { height: 32px; padding: 0 2px 0 10px; display: flex; align-items: center; gap: 2px; font-size: 13px; font-weight: 600; color: var(--k-red-deep); }
.fc-act { position: relative; display: flex; flex-direction: column; background: transparent; }
.fc-act--col { min-height: 0; }
.fc-act--wide { height: auto; }
.fc-act__img { width: 100%; height: 164px; border-radius: 16px; }
.fc-act__tag { position: absolute; left: 10px; top: 10px; height: 22px; padding: 0 8px; border-radius: 6px; background: var(--k-paper); color: var(--k-ink2); font-size: 11px; font-weight: 500; display: flex; align-items: center; }
.fc-act__copy { padding: 12px 0 0; display: flex; flex-direction: column; gap: 6px; color: var(--k-ink); }
.fc-act__title { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; font-weight: 600; font-size: 16px; line-height: 1.5; word-break: break-all; }
.fc-act__meta { font-size: 12px; line-height: 1.5; color: var(--k-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
/* 找搭子：分类小字横滑 + 右边「筛选」 */
.bbar { display: flex; align-items: center; gap: 8px; padding-top: 10px; }
.bbar__cats { flex: 1; min-width: 0; white-space: nowrap; }
.bbar__row { display: flex; gap: 8px; width: max-content; padding: 2px 0; }
.bbar__filter { flex: 0 0 auto; height: 30px; padding: 0 10px; border-radius: 999px; background: var(--k-paper); box-shadow: var(--k-sh1); display: flex; align-items: center; gap: 4px; font-size: 13px; color: var(--k-ink); }
.bbar__filter.on { color: var(--k-red); font-weight: 600; }
.bbar__num { min-width: 16px; height: 16px; padding: 0 4px; border-radius: 8px; background: var(--k-red); color: #fff; font-size: 10px; line-height: 16px; text-align: center; }
.ftags { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.ftag { height: 26px; padding: 0 8px 0 10px; border-radius: 999px; background: var(--k-red-soft); color: var(--k-red-deep); font-size: 12px; display: flex; align-items: center; gap: 4px; }
/* 出行安全须知入口：赭黄浅底一行，列表与找搭子帖详情共用 */
.safety-line { margin-top: 12px; padding: 9px 10px 9px 12px; border-radius: 12px; background: var(--k-ochre-soft); display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--k-ink); }
.safety-line--detail { margin-top: 14px; }
.safety-line__title { font-weight: 600; flex: 0 0 auto; }
.safety-line__sub { color: var(--k-ink2); font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mate { padding: 16px; }
.mate__main { display: flex; gap: 12px; }
.mate__tile { flex: 0 0 auto; width: 76px; height: 92px; border-radius: 12px; overflow: hidden; background: var(--k-paper2); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; }
.mate__img { width: 100%; height: 100%; }
.mate__day { font-size: 15px; font-weight: 700; color: var(--k-ink); }
.mate__body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 5px; }
.mate__title { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; font-weight: 600; font-size: 17px; line-height: 1.5; color: var(--k-ink); word-break: break-all; }
.mate__chips { display: flex; flex-wrap: wrap; gap: 4px; }
.mate__row { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--k-ink2); }
.mate__row-text { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mate__foot { margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--k-line); display: flex; align-items: center; gap: 8px; }
.mate__who { flex: 1; min-width: 0; display: flex; align-items: center; gap: 6px; }
.mate__avatar { flex: 0 0 auto; width: 24px; height: 24px; border-radius: 50%; background: var(--k-paper2); }
.own-marker { flex: 0 0 auto; white-space: nowrap; font-size: 12px; color: var(--k-red); }
.mate__name { min-width: 0; font-size: 13px; color: var(--k-ink2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mate__signed { flex: 0 0 auto; display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--k-muted); }
.avs { display: flex; }
.avs__a { width: 22px; height: 22px; border-radius: 50%; border: 1.5px solid var(--k-paper); margin-left: -7px; }
.avs__a:first-child { margin-left: 0; }
/* 找搭子「筛选」面板 */
.fsheet { max-height: 82vh; overflow-y: auto; }
/* #ifdef H5 */
/* 弹层自己滚到头时不带着后面的页面滚（页面本身由 lockPageScroll 锁住） */
.fsheet { overscroll-behavior: contain; }
/* #endif */
.fsheet__head { display: flex; align-items: center; justify-content: space-between; }
.fsheet__title { font-size: 17px; font-family: var(--k-display-font); font-weight: 700; color: var(--k-ink); }
.fsheet__close { width: 36px; height: 36px; margin-right: -8px; display: flex; align-items: center; justify-content: center; }
.fsheet__label { display: block; margin: 16px 0 8px; font-size: 14px; font-weight: 600; color: var(--k-ink); }
.fsheet__pills { display: flex; flex-wrap: wrap; gap: 8px; }
.fpill { height: 34px; padding: 0 14px; border-radius: 999px; background: var(--k-paper2); color: var(--k-ink2); font-size: 13px; display: flex; align-items: center; gap: 4px; }
.fpill.on { background: var(--k-red); color: #fff; font-weight: 600; }
.fsheet__switch { margin-top: 18px; display: flex; align-items: center; gap: 12px; }
.fsheet__switch-title { display: block; font-size: 14px; font-weight: 600; color: var(--k-ink); }
.fsheet__switch-sub { display: block; margin-top: 2px; font-size: 12px; color: var(--k-muted); }
.fsheet__help { margin-top: 8px; display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: var(--k-muted); }
.fsheet__foot { margin-top: 20px; display: flex; align-items: center; gap: 12px; }
.fsheet__reset { flex: 0 0 auto; width: 96px; height: 44px; border: 1px solid var(--k-line2); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 15px; color: var(--k-ink); }
/* 帖子详情里的头像、名字（信息流卡片用 fc__*） */
.post__head { display: flex; align-items: flex-start; gap: 10px; }
.post__avatar { width: 32px; height: 32px; border-radius: 50%; flex: 0 0 auto; }
.post__avatar--lg { width: 36px; height: 36px; }
.post__name { font-family: var(--k-serif); font-weight: 700; font-size: 15px; }
.post__name--lg { font-size: 16px; }
/* 评论区页签（全局 .k-tabs 员工端还在用，只在本页改）：选中黑字加粗大一号，下面一道短线、不画底线 */
.k-tabs { border-bottom: 0; }
.k-tabs__item.active { color: var(--k-ink); font-size: 16px; font-weight: 600; }
.k-tabs__item.active::after { bottom: 3px; width: 16px; height: 3px; margin-left: -8px; }
/* 帖子详情 */
.hero { position: relative; margin: 4px 6px 0; height: 193px; border-radius: 12px; overflow: hidden; background: #DDD3C4; }
.hero__img { width: 100%; height: 100%; }
.hero__badge { position: absolute; right: 12px; top: 10px; height: 22px; padding: 0 9px; border-radius: 11px; background: rgba(60,50,45,.6); color: #fff; font-size: 13px; display: flex; align-items: center; }
.hero__dots { position: absolute; left: 0; right: 0; bottom: 8px; display: flex; justify-content: center; gap: 6px; }
.hero__dot { width: 6px; height: 6px; border-radius: 3px; background: rgba(255,255,255,.55); }
.hero__dot.on { width: 12px; background: #fff; }
/* 没图的帖子：类型色渐变条（和信息流开篇卡 .fc__band 同一套：类型小字、浅色大引号、右上袋鼠贴纸） */
.dband { position: relative; margin: 4px 6px 0; height: 104px; padding: 18px 16px 0; box-sizing: border-box; border-radius: 12px; background: linear-gradient(120deg, var(--kc-soft) 0%, var(--kc-soft2) 100%); overflow: hidden; }
.dband__quote { position: absolute; right: 88px; top: 20px; display: flex; opacity: .14; }
.dband__logo { position: absolute; right: 18px; top: 16px; width: 56px; height: 60px; }
.detail__title { display: block; margin-top: 16px; font-family: var(--k-serif); font-weight: 700; font-size: 20px; line-height: 1.4; }
/* 详情里的关联卡：浅米色底，小封面 + 「关联」+ 标题 + 类型小标签 */
.link-card { margin-top: 14px; padding: 10px 12px; border-radius: 14px; background: #FBF4EA; border: 1px solid rgba(154, 107, 63, .12); display: flex; align-items: center; gap: 10px; }
.link-card__img { flex: 0 0 auto; width: 48px; height: 48px; border-radius: 10px; background: var(--k-paper2); }
.link-card__img--empty { display: flex; align-items: center; justify-content: center; background: var(--k-paper); }
.link-card__copy { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.link-card__label { font-size: 12px; color: var(--k-muted); }
.link-card__title { font-size: 15px; font-family: var(--k-display-font); font-weight: 700; color: var(--k-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.link-card__sub { font-size: 12px; color: var(--k-ink2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.link-card__tag { flex: 0 0 auto; height: 20px; padding: 0 7px; border-radius: 6px; background: var(--k-paper); color: var(--k-red-deep); font-size: 11px; font-weight: 600; line-height: 20px; }
.detail__body { display: block; margin-top: 10px; font-size: 14px; line-height: 1.85; color: var(--k-ink); }
/* 2026-10-17：作者看自己审核中的帖子，正文下面的说明 */
.pending-line { margin-top: 12px; padding: 8px 10px; border-radius: 8px; background: var(--k-ochre-soft); display: flex; align-items: flex-start; gap: 6px; font-size: 12px; line-height: 1.6; color: var(--k-ochre-deep); }
.act-link { margin-top: 14px; padding: 10px 12px; border-radius: 8px; background: var(--k-green-soft); display: flex; align-items: center; gap: 8px; font-size: 14px; color: var(--k-ink); }
.tag { height: 28px; padding: 0 10px; border: 1px solid var(--k-line2); border-radius: 6px; background: var(--k-paper); display: flex; align-items: center; gap: 4px; font-size: 13px; color: #4A5560; }
.rel { gap: 8px; }
.rel__card { padding: 10px 8px 8px; border-radius: 12px; display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.rel__card--blue { background: #ECEFF0; }
.rel__card--green { background: #E9EFE7; }
.rel__chip { align-self: flex-start; height: 20px; padding: 0 6px; border-radius: 4px; font-size: 11px; display: flex; align-items: center; }
.rel__chip--blue { background: var(--k-indigo-soft); color: var(--k-indigo); }
.rel__chip--green { background: var(--k-green-soft); color: var(--k-green); }
.rel__title { font-family: var(--k-serif); font-weight: 700; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rel__meta { font-size: 11px; color: var(--k-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rel__price { color: var(--k-red); font-weight: 700; font-size: 14px; font-family: var(--k-sans); }
.rel__status { display: flex; align-items: center; gap: 3px; font-size: 13px; font-weight: 700; }
.rel__status--green { color: var(--k-green); }
.rel__status--ochre { color: #B0782A; }
.rel__img { width: 100%; height: 64px; border-radius: 8px; margin-top: 2px; }
.actbar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 50; background: var(--k-paper); border-top: 1px solid var(--k-line); display: flex; flex-wrap: wrap; }
.actbar__item { width:20%; flex:0 0 20%; min-width:0; height:58px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; font-size:12px; }
.actbar__item text { white-space:nowrap; }
.actbar__item.share-btn { justify-content: center; }
.actbar__item--off { color: var(--k-light); }
.actbar__safe { flex:0 0 100%; width: 100%; height: var(--k-safe-bottom); }
/* 详情页底部垫高：= 操作栏 58px + 手机底部安全区 + 24px 余量。不只靠变量：个别机型上 calc 里套 var(env()) 不生效，
   整条样式作废、垫高变成 0，最后一段就被操作栏挡住；所以先写一个够用的固定值，再用 constant() / env() 覆盖 */
.actbar-spacer { height: 116px; height: calc(82px + constant(safe-area-inset-bottom)); height: calc(82px + env(safe-area-inset-bottom)); }
/* #ifdef H5 */
.actbar-spacer { height: 116px; } /* H5 预览里底部安全区固定画成 34px */
/* #endif */
/* 评论 */
.ctabs { margin-top: 4px; }
.ctabs .k-tabs__item { padding: 8px 16px 10px; font-size: 16px; }
.ctabs .k-tabs__item.active { font-family: var(--k-serif); font-weight: 700; font-size: 18px; }
.comments { padding: 0 16px 234px; padding-bottom: calc(200px + constant(safe-area-inset-bottom)); padding-bottom: calc(200px + env(safe-area-inset-bottom)); }
.comment { padding: 12px 0 14px; border-bottom: 1px solid var(--k-line); }
.comment__avatar { width: 32px; height: 32px; border-radius: 50%; flex: 0 0 auto; }
.comment__name { font-family: var(--k-serif); font-weight: 700; font-size: 15px; }
.comment__likes { font-size: 14px; }
.comment__text { display: block; margin-top: 8px; font-size: 14px; line-height: 1.7; }
.comment__reply { display: block; margin-top: 6px; font-size: 13px; color: var(--k-muted); }
.comment__nest { margin-top: 12px; padding: 10px 12px 12px; border-radius: 12px; background: var(--k-paper2); }
.author { height: 20px; padding: 0 6px; border-radius: 4px; background: var(--k-ochre-soft); color: var(--k-red); font-size: 12px; font-weight: 600; display: flex; align-items: center; }
.comment__more { color: var(--k-indigo); font-size: 14px; padding-left: 12px; }
.cbar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 50; background: var(--k-bg); border-top: 1px solid var(--k-line); padding: 12px 16px 0; }
.cbar__input { height: 44px; border-radius: 10px; }
.cbar__send { height: 44px; padding: 0 20px; border-radius: 8px; background: var(--k-red); color: #fff; font-size: 16px; font-weight: 600; display: flex; align-items: center; }
.cbar__off { height: 44px; border-radius: 10px; background: var(--k-paper2); display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 14px; color: var(--k-muted); }
.cbar__ghost { height: 32px; padding: 0 30px; border: 1px solid var(--k-line2); border-radius: 6px; background: var(--k-paper); font-size: 13px; display: flex; align-items: center; }
.cbar__notice { margin-top: 12px; height: 38px; border: 1px solid var(--k-line2); border-radius: 10px; background: var(--k-paper); display: flex; align-items: center; justify-content: center; gap: 14px; font-size: 13px; color: var(--k-ink); }
.cbar__safe { height: calc(10px + var(--k-safe-bottom)); }
.fc-col__verified { flex: 0 0 auto; display: flex; align-items: center; color: var(--k-green); }
.fc-act--plain .fc-act__tag { position: static; align-self: flex-start; margin: 12px 12px 0; background: var(--k-paper2); }
.fc-col__stat--cmt { cursor: pointer; }
@import "./community-reference.scss";
.party-tools-entry{display:flex;align-items:center;gap:8px;padding:12px 0;margin-top:8px;border-bottom:1px solid var(--k-line);font-size:12px;color:var(--k-muted)}.party-tools-entry>text:first-of-type{color:var(--k-ink);font-weight:600}
</style>

<style lang="scss">
/* 搜索框提示字：小程序里 placeholder 不带 scoped 的 data-v 类，写在 scoped 里不生效，单独放这里（类名带页面前缀，H5 里也不会串到别的页面） */
.community-search-ph { color: var(--k-muted); font-size: 14px; }
.party-tools-entry{display:flex;align-items:center;gap:8px;padding:12px 0;margin-top:8px;border-bottom:1px solid var(--k-line);font-size:12px;color:var(--k-muted)}.party-tools-entry>text:first-of-type{color:var(--k-ink);font-weight:600}
</style>

<style scoped>
.member-frame{outline:2px solid #c69a60;outline-offset:2px}.member-highlight{color:#8a5e31!important}.fc__name-row{flex-wrap:wrap}
.party-tools-entry{display:flex;align-items:center;gap:8px;padding:12px 0;margin-top:8px;border-bottom:1px solid var(--k-line);font-size:12px;color:var(--k-muted)}.party-tools-entry>text:first-of-type{color:var(--k-ink);font-weight:600}
</style>

<style scoped>.fc-col__achievement{display:flex;margin-top:6px;flex-wrap:wrap}.fc-col__achievement :deep(.member-mark){max-width:100%;white-space:normal;overflow-wrap:anywhere}.party-tools-entry{display:flex;align-items:center;gap:8px;padding:12px 0;margin-top:8px;border-bottom:1px solid var(--k-line);font-size:12px;color:var(--k-muted)}.party-tools-entry>text:first-of-type{color:var(--k-ink);font-weight:600}
</style>

<style scoped>
.comment-emoji-toggle{margin:0;padding:4px;background:transparent;line-height:1}.comment-emoji-toggle:after,.comment-emojis button:after{border:0}.comment-emojis{display:grid;grid-template-columns:repeat(8,1fr);gap:4px;padding:10px 0}.comment-emojis button{padding:6px 0;font-size:23px;line-height:1.3;background:transparent;margin:0}
.party-tools-entry{display:flex;align-items:center;gap:8px;padding:12px 0;margin-top:8px;border-bottom:1px solid var(--k-line);font-size:12px;color:var(--k-muted)}.party-tools-entry>text:first-of-type{color:var(--k-ink);font-weight:600}
</style>

<style scoped>
.comment-attachments{display:flex;align-items:center;gap:12px;margin-top:8px;flex-wrap:wrap}.comment-attachments>text{font-size:12px;color:var(--k-muted)}
.comment-image-toggle{padding:0 12px;margin:0;flex-shrink:0;min-height:44px;display:flex;gap:6px;align-items:center;justify-content:center;background:var(--k-paper);border:1px solid var(--k-line);border-radius:10px;font-size:14px;line-height:1.5;color:var(--k-ink)}.comment-image-toggle:after{border:0}.comment-image-toggle[disabled]{opacity:.5}
.comment-error{display:block;color:var(--k-alert);font-size:13px;line-height:1.6;margin-top:8px}
.comment-draft-images{display:flex;gap:10px;margin-bottom:10px}.comment-draft-images>view{position:relative;width:64px;height:64px}.comment-draft-images image{width:64px;height:64px;border-radius:8px}.comment-draft-images button{position:absolute;right:-4px;top:-4px;width:24px;height:24px;padding:0;line-height:24px;border-radius:50%;background:var(--k-paper);color:var(--k-alert)}
.comment-reply-target{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;font-size:13px;color:var(--k-muted)}.comment-reply-target button{margin:0;padding:0 8px;font-size:12px;line-height:28px;background:transparent;color:var(--k-red)}
.cbar__input{min-width:0}.cbar__send{margin:0;padding:0 12px;flex-shrink:0;font-size:14px;line-height:44px}.cbar__send[disabled]{opacity:.5}.comment__nest{min-width:0}
</style>
