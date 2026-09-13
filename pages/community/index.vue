<template>
  <view class="k-page community">
    <!-- 1 大理同城信息流 -->
    <template v-if="s === 1">
      <k-topbar>
        <template #left>
          <view class="brand">
            <text class="brand__name">袋鼠小院</text>
            <view class="brand__city"><k-icon name="map-pin" :size="15" color="ink" :stroke="1.8" fill /><text>大理</text><k-icon name="chevron-down" :size="13" color="ink" /></view>
          </view>
        </template>
        <view class="search">
          <k-icon name="search" :size="16" color="muted" :stroke="1.8" />
          <text class="search__ph">想去哪儿，想做什么？</text>
          <view class="search__btn"><text>搜索</text></view>
        </view>
        <view class="k-tabs">
          <view v-for="t in feedTabs" :key="t" class="k-tabs__item" :class="{ active: feedTab === t }" @click="onFeedTab(t)"><text>{{ t }}</text></view>
        </view>
      </k-topbar>

      <view class="feed k-pad-tab">
        <view class="k-section hot-head"><text class="k-section__title">本周热门</text><view class="k-section__more" @click="go(R.activity)"><text>更多</text><k-icon name="chevron-right" :size="13" color="muted" /></view></view>
        <scroll-view scroll-x class="hot" :show-scrollbar="false">
          <view class="hot__row">
            <view v-for="h in hots" :key="h.title" class="hot__card" @click="go(R.activity + '?s=3')">
              <image class="hot__img" :src="h.img" mode="aspectFill" />
              <view class="hot__shade" />
              <view v-if="h.top" class="hot__top"><text>置顶</text></view>
              <view class="hot__copy">
                <text class="hot__title">{{ h.title }}</text>
                <view class="hot__meta"><k-icon name="map-pin" :size="12" color="white" :stroke="1.8" /><text>{{ h.date }}</text></view>
                <view class="hot__meta"><k-icon name="clock" :size="12" color="white" :stroke="1.8" /><text>{{ h.count }}人报名</text></view>
              </view>
            </view>
          </view>
        </scroll-view>

        <view class="sort">
          <view class="sort__item"><text>最新</text><k-icon name="chevron-down" :size="14" color="ink" :stroke="2.2" fill /></view>
          <view class="sort__line" />
          <view class="sort__item"><text>大理</text><k-icon name="chevron-down" :size="14" color="ink" :stroke="2.2" fill /></view>
        </view>

        <view v-for="postItem in posts" :key="postItem.name" class="post">
          <view class="post__head">
            <image class="post__avatar" :src="postItem.avatar" mode="aspectFill" />
            <view class="k-flex1">
              <view class="k-row k-gap6">
                <text class="post__name" @click="s = 3">{{ postItem.name }}</text>
                <k-chip v-if="postItem.real" tone="ochre">实名</k-chip>
                <k-chip v-if="postItem.verified" tone="green">行程已验证</k-chip>
                <k-icon v-if="postItem.real" name="circle-check" :size="13" color="light" :stroke="1.6" />
                <text class="k-meta">{{ postItem.date }}</text>
              </view>
              <text v-if="postItem.dateBelow" class="k-meta post__date">{{ postItem.date }}</text>
            </view>
            <view class="follow" @click="toast('已关注')"><text>关注</text></view>
          </view>
          <text class="post__text" @click="s = 3">{{ postItem.text }}</text>
          <view class="post__imgs" @click="s = 3">
            <view v-for="(img, i) in postItem.imgs" :key="i" class="post__img-box">
              <image class="post__img" :src="img" mode="aspectFill" />
            </view>
          </view>
          <view class="post__actions">
            <view class="post__action"><k-icon name="heart" :size="20" color="ink" :stroke="1.6" /><text>赞 {{ postItem.likes }}</text></view>
            <view class="post__action" @click="s = 4"><k-icon name="message-circle" :size="20" color="ink" :stroke="1.6" /><text>评论 {{ postItem.comments }}</text></view>
            <view class="post__action" @click="toast('分享')"><k-icon name="share" :size="20" color="ink" :stroke="1.6" /><text>分享</text></view>
          </view>
        </view>
      </view>
      <k-tabbar active="community" />
    </template>

    <!-- 2 找搭子分类 -->
    <template v-else-if="s === 2">
      <k-topbar title="找搭子" back @back="s = 1" />
      <view class="k-body k-pad-tab">
        <view class="drops">
          <view class="drop"><k-icon name="map-pin" :size="15" color="ink" :stroke="1.8" fill /><text class="k-flex1">大理</text><k-icon name="chevron-down" :size="14" color="ink" /></view>
          <view class="drop"><text class="k-flex1">日期</text><k-icon name="chevron-down" :size="14" color="ink" /></view>
          <view class="drop"><text class="k-flex1">同行天数</text><k-icon name="chevron-down" :size="14" color="ink" /></view>
        </view>
        <scroll-view scroll-x class="cats" :show-scrollbar="false">
          <view class="cats__row">
            <view v-for="c in cats" :key="c" class="cat" :class="{ on: cat === c }" @click="cat = c"><text>{{ c }}</text></view>
          </view>
        </scroll-view>
        <view class="k-between k-mt12">
          <view class="k-row k-gap8">
            <view class="vchip"><k-icon name="shield-check" :size="14" color="green" :stroke="1.8" fill /><text>实名用户</text></view>
            <view class="vchip"><k-icon name="shield-check" :size="14" color="green" :stroke="1.8" fill /><text>行程已验证</text><k-icon name="circle-help" :size="12" color="muted" /></view>
          </view>
          <view class="k-row k-gap4"><k-icon name="list-filter" :size="16" color="ink" :stroke="1.8" /><text class="k-small">筛选</text></view>
        </view>

        <k-card v-for="m in mates" :key="m.title" class="mate" :pad="10" :radius="12" @click="s = 3">
          <view class="k-row-start k-gap12">
            <image class="mate__img" :src="m.img" mode="aspectFill" />
            <view class="k-flex1 mate__body">
              <view class="k-between"><text class="mate__title">{{ m.title }}</text></view>
              <view class="mate__row"><k-icon name="clock" :size="14" color="muted" :stroke="1.6" /><text class="k-flex1">{{ m.time }}</text><k-chip v-if="m.chip === 'verified'" tone="green">行程已验证</k-chip><k-chip v-else-if="m.chip === 'real'" tone="ochre">实名用户</k-chip></view>
              <view class="mate__row"><k-icon name="map-pin" :size="14" color="muted" :stroke="1.6" /><text>{{ m.place }}</text></view>
              <view class="mate__row"><k-icon name="heart" :size="14" color="muted" :stroke="1.6" /><text>同行天数：{{ m.days }}</text></view>
              <view class="k-between k-mt8">
                <view class="k-row k-gap8">
                  <view class="avs"><image v-for="(a, i) in avatars4" :key="i" class="avs__a" :src="a" mode="aspectFill" /></view>
                  <text class="k-small k-muted">{{ m.count }}人报名</text>
                </view>
                <k-button size="sm" @click.stop="go(R.chat)">发起认识一下</k-button>
              </view>
            </view>
          </view>
          <view v-if="m.both" class="k-row k-gap8 k-mt8 mate__tags">
            <view class="vchip vchip--sm"><k-icon name="shield-check" :size="12" color="green" :stroke="1.8" fill /><text>实名用户</text></view>
            <view class="vchip vchip--sm vchip--green"><k-icon name="shield-check" :size="12" color="green" :stroke="1.8" fill /><text>行程已验证</text></view>
          </view>
        </k-card>
      </view>
      <k-tabbar active="community" />
    </template>

    <!-- 3 帖子详情 -->
    <template v-else-if="s === 3">
      <k-topbar title="帖子详情" back @back="s = 1" />
      <view class="detail k-pad-bottom">
        <view class="hero">
          <image class="hero__img" src="/static/media/community-sunrise-hero.jpg" mode="aspectFill" />
          <view class="hero__badge"><text>1/6</text></view>
          <view class="hero__dots"><view class="hero__dot" /><view class="hero__dot on" /><view class="hero__dot" /><view class="hero__dot" /></view>
        </view>
        <view class="k-body">
          <view class="post__head">
            <image class="post__avatar post__avatar--lg" src="/static/media/community-avatar-abu.jpg" mode="aspectFill" />
            <view class="k-flex1">
              <view class="k-row k-gap6"><text class="post__name post__name--lg">阿布在大理</text><k-chip tone="ochre">实名</k-chip><k-chip tone="green">行程已验证</k-chip></view>
              <view class="k-row k-gap10 k-mt4"><text class="k-meta">9月5日</text><text class="k-meta">大理</text></view>
            </view>
            <view class="follow follow--lg" @click="toast('已关注')"><text>关注</text></view>
          </view>
          <text class="detail__title">在大理的第7天，和新朋友一起看日出</text>
          <text class="detail__body k-pre">清晨5点出发，沿着小路慢慢往上走，云海翻涌，\n阳光洒在苍山上，真的太治愈了～\n一路上认识了很多有趣的小伙伴，大家互相鼓励，互相\n拍照，山顶的风很大，但心里很暖。</text>
          <view class="k-row k-gap8 k-mt16">
            <view v-for="t in tags" :key="t" class="tag"><text>#</text><text>{{ t }}</text></view>
          </view>
          <view class="k-divider k-mt20" />
          <view class="k-section"><text class="k-section__title">关联推荐</text><view class="k-section__more" @click="go(R.home)"><text>查看全部</text><k-icon name="chevron-right" :size="13" color="muted" /></view></view>
          <view class="k-grid-3 rel">
            <view v-for="r in related" :key="r.title" class="rel__card" :class="`rel__card--${r.tone}`" @click="go(r.to)">
              <view class="rel__chip" :class="`rel__chip--${r.tone}`"><text>{{ r.kind }}</text></view>
              <text class="rel__title">{{ r.title }}</text>
              <view class="rel__meta"><text v-if="r.price" class="rel__price">{{ r.price }}</text><text>{{ r.meta }}</text></view>
              <view class="rel__status" :class="`rel__status--${r.statusTone}`"><k-icon v-if="r.shield" name="shield-check" :size="16" color="green" :stroke="1.8" fill /><text>{{ r.status }}</text></view>
              <image class="rel__img" :src="r.img" mode="aspectFill" />
            </view>
          </view>
        </view>
      </view>
      <view class="actbar">
        <view class="actbar__item"><k-icon name="heart" :size="24" color="ink" :stroke="1.5" /><text>赞 28</text></view>
        <view class="actbar__item" @click="s = 4"><k-icon name="message-circle" :size="24" color="ink" :stroke="1.5" /><text>评论 12</text></view>
        <view class="actbar__item"><k-icon name="star" :size="24" color="ink" :stroke="1.5" /><text>收藏</text></view>
        <view class="actbar__item" @click="toast('分享')"><k-icon name="share" :size="24" color="ink" :stroke="1.5" /><text>分享</text></view>
        <view class="actbar__safe" />
        <view class="k-home-indicator" />
      </view>
    </template>

    <!-- 4 评论互动 -->
    <template v-else>
      <k-topbar title="全部评论（12）" back @back="s = 3" />
      <view class="k-tabs k-tabs--left ctabs">
        <view v-for="t in ['热评', '最新']" :key="t" class="k-tabs__item" :class="{ active: ctab === t }" @click="ctab = t"><text>{{ t }}</text></view>
      </view>
      <view class="comments">
        <view v-for="c in comments" :key="c.name" class="comment">
          <view class="k-row-start k-gap10">
            <image class="comment__avatar" :src="c.avatar" mode="aspectFill" />
            <view class="k-flex1">
              <view class="k-between">
                <view class="k-row k-gap6"><text class="comment__name">{{ c.name }}</text><k-chip v-for="t in c.chips" :key="t" :tone="t === '行程已验证' ? 'green' : 'ochre'">{{ t }}</k-chip><text class="k-meta">9-05</text></view>
                <view class="k-row k-gap4"><text class="comment__likes">{{ c.likes }}</text><k-icon name="thumbs-up" :size="18" color="ink" :stroke="1.5" /></view>
              </view>
              <text class="comment__text k-pre">{{ c.text }}</text>
              <text class="comment__reply">回复</text>
              <view v-if="c.author" class="comment__nest">
                <view class="k-between">
                  <view class="k-row k-gap6"><view class="author"><text>作者</text></view><text class="comment__name">阿布在大理</text><k-chip tone="ochre">实名</k-chip><k-chip tone="green">行程已验证</k-chip><text class="k-meta">9-05</text></view>
                  <view class="k-row k-gap4"><text class="comment__likes">{{ c.author.likes }}</text><k-icon name="thumbs-up" :size="18" color="ink" :stroke="1.5" /></view>
                </view>
                <text class="comment__text k-pre">{{ c.author.text }}</text>
                <text class="comment__reply">回复</text>
              </view>
              <view v-if="c.more" class="k-row k-gap4 k-mt8 comment__more"><text>展开 {{ c.more }} 条回复</text><k-icon name="chevron-down" :size="14" color="indigo" /></view>
            </view>
          </view>
        </view>
      </view>
      <view class="cbar">
        <view class="k-row k-gap10">
          <view class="k-input k-flex1 cbar__input"><input v-model="draft" placeholder="友善评论，从心开始" placeholder-class="k-placeholder" /><k-icon name="smile" :size="22" color="ink" :stroke="1.5" /></view>
          <view class="cbar__send" @click="toast('已发送')"><text>发送</text></view>
        </view>
        <view class="k-center-box k-gap16 k-mt12">
          <view class="cbar__ghost"><text>举报</text></view>
          <view class="cbar__ghost"><text>屏蔽该用户</text></view>
        </view>
        <view class="cbar__notice"><k-icon name="sprout" :size="16" color="green" :stroke="1.8" /><text>友善社区，温暖同行。请尊重每一位伙伴～</text><k-icon name="sprout" :size="16" color="green" :stroke="1.8" /></view>
        <view class="cbar__safe" />
        <view class="k-home-indicator" />
      </view>
    </template>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { useScreen, go, toast } from '@/common/screen.js'
import R from '@/common/routes.js'

const s = useScreen(4)
const feedTabs = ['全部', '找搭子', '义工日记', '旅居日常']
const feedTab = ref('全部')
const onFeedTab = (t) => { feedTab.value = t; if (t === '找搭子') s.value = 2 }
const cats = ['全部', '徒步登山', '摄影', '咖啡美食', '骑行']
const cat = ref('全部')
const ctab = ref('热评')
const draft = ref('')

const hots = [
  { title: '苍山日出徒步', date: '9月7日（周日）', count: 18, top: true, img: '/static/media/community-hot-sunrise.jpg' },
  { title: '古城咖啡拉花体验', date: '9月6日（周六）', count: 12, top: true, img: '/static/media/community-hot-coffee.jpg' },
  { title: '周末草地音乐会', date: '9月7日（周日）', count: 26, top: false, img: '/static/media/community-hot-concert.jpg' }
]
const posts = [
  { name: '阿布在大理', avatar: '/static/media/community-avatar-abu.jpg', real: true, date: '9-05', dateBelow: true, likes: 28, comments: 12,
    text: '在大理的第7天，清晨5点和新朋友一起爬苍山看日出，太美了！',
    imgs: ['/static/media/community-post-1-1.jpg', '/static/media/community-post-1-2.jpg', '/static/media/community-post-1-3.jpg'] },
  { name: '小满同学', avatar: '/static/media/community-avatar-xiaoman.jpg', verified: true, date: '9-04', likes: 16, comments: 5,
    text: '喜洲古镇的稻田咖啡，风吹稻浪，咖啡真香～',
    imgs: ['/static/media/community-post-2-1.jpg', '/static/media/community-post-2-2.jpg', '/static/media/community-post-2-3.jpg'] }
]
const avatars4 = ['/static/media/community-avatar-abu.jpg', '/static/media/community-avatar-luyu.jpg', '/static/media/community-avatar-shanye.jpg', '/static/media/community-avatar-yunduo.jpg']
const mates = [
  { title: '苍山日出徒步', time: '9月7日（周日）05:30', place: '集合：喜洲古镇', days: '1天', count: 18, chip: 'verified', img: '/static/media/community-hot-sunrise.jpg' },
  { title: '古城咖啡拉花体验', time: '9月6日（周六）14:00', place: '大理古城', days: '半天', count: 12, chip: 'real', img: '/static/media/community-hot-coffee.jpg' },
  { title: '周末草地音乐会', time: '9月7日（周日）16:30', place: '洱海生态廊道', days: '1天', count: 26, chip: '', both: true, img: '/static/media/community-hot-concert.jpg' },
  { title: '古城咖啡拉花体验', time: '9月8日（周一）10:00', place: '大理古城', days: '半天', count: 8, chip: 'real', img: '/static/media/community-hot-coffee.jpg' }
]
const tags = ['苍山徒步', '大理日常', '旅居生活']
const related = [
  { kind: '招聘', tone: 'blue', title: '民宿前台接待', meta: '大理古城 · 月薪 4-6K', status: '安心商家', shield: true, statusTone: 'green', img: '/static/media/community-rel-reception.jpg', to: R.jobDetail },
  { kind: '房源', tone: 'green', title: '西洱边 · 温馨一居室', price: '2800', meta: ' 元/月 · 1室1厅', status: '安心房源', shield: true, statusTone: 'green', img: '/static/media/community-rel-room.jpg', to: R.stayDetail },
  { kind: '活动', tone: 'blue', title: '苍山日出徒步', meta: '9/7 周日 05:30 集合', status: '报名中', statusTone: 'ochre', img: '/static/media/community-hot-sunrise.jpg', to: R.activity + '?s=3' }
]
const comments = [
  { name: '山野来信', avatar: '/static/media/community-avatar-shanye.jpg', chips: ['实名', '置顶'], likes: 12, text: '照片拍得太美了！我也在山顶，看到你们了～\n那天的云海真的绝了！' },
  { name: '云朵不说话', avatar: '/static/media/community-avatar-yunduo.jpg', chips: ['行程已验证'], likes: 8, text: '跟着你们的路线走，风景一级棒，感谢分享！\n下次一起去洱海吧～', author: { likes: 5, text: '好呀！下次可以一起骑行环洱海～' }, more: 2 },
  { name: '小满同学', avatar: '/static/media/community-avatar-xiaoman.jpg', chips: ['行程已验证'], likes: 3, text: '求问徒步路线和装备清单，准备周末去！', author: { likes: 2, text: '路线在图7有标注，装备建议轻便防风外套、\n登山鞋和水～' } }
]
</script>

<style scoped lang="scss">
/* 顶部品牌 / 搜索 */
.brand { display: flex; align-items: center; gap: 12px; padding-left: 8px; }
.brand__name { font-family: var(--k-serif); font-weight: 700; font-size: 20px; letter-spacing: 1px; }
.brand__city { display: flex; align-items: center; gap: 3px; font-size: 15px; }
.search { margin: 4px 16px 6px; height: 36px; display: flex; align-items: center; gap: 8px; padding: 0 4px 0 12px; border: 1px solid var(--k-line2); border-radius: 999px; background: var(--k-paper); }
.search__ph { flex: 1; font-size: 14px; color: var(--k-light); }
.search__btn { height: 28px; padding: 0 12px; border-radius: 999px; background: var(--k-paper2); display: flex; align-items: center; font-size: 13px; color: var(--k-ink); }
.feed { padding: 0 16px; }
.hot-head { margin: 12px 0 10px; }
.hot { width: 100%; white-space: nowrap; }
.hot__row { display: flex; gap: 6px; width: max-content; }
.hot__card { position: relative; width: 132px; height: 187px; border-radius: 10px; overflow: hidden; background: #DDD3C4; flex: 0 0 auto; }
.hot__img { width: 100%; height: 100%; }
.hot__shade { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(15,10,6,.7) 100%); }
.hot__top { position: absolute; left: 6px; top: 6px; height: 20px; padding: 0 6px; border-radius: 4px; background: var(--k-red); color: #fff; font-size: 11px; font-weight: 600; display: flex; align-items: center; }
.hot__copy { position: absolute; left: 8px; right: 6px; bottom: 8px; display: flex; flex-direction: column; gap: 3px; color: #fff; }
.hot__title { font-family: var(--k-serif); font-weight: 700; font-size: 14px; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hot__meta { display: flex; align-items: center; gap: 4px; font-size: 11px; white-space: nowrap; }
.sort { display: flex; align-items: center; gap: 14px; margin: 14px 0 8px; padding: 0 4px; }
.sort__item { display: flex; align-items: center; gap: 4px; font-size: 15px; }
.sort__line { width: 1px; height: 14px; background: var(--k-line2); }
/* 帖子 */
.post { padding: 12px 0 14px; border-bottom: 1px solid var(--k-line); }
.post:last-child { border-bottom: 0; }
.post__head { display: flex; align-items: flex-start; gap: 10px; }
.post__avatar { width: 32px; height: 32px; border-radius: 50%; flex: 0 0 auto; }
.post__avatar--lg { width: 36px; height: 36px; }
.post__name { font-family: var(--k-serif); font-weight: 700; font-size: 15px; }
.post__name--lg { font-size: 16px; }
.post__date { display: block; margin-top: 2px; }
.follow { height: 24px; padding: 0 9px; border: 1px solid var(--k-red); border-radius: 5px; color: var(--k-red); font-size: 12px; display: flex; align-items: center; flex: 0 0 auto; }
.follow--lg { height: 28px; padding: 0 14px; font-size: 14px; border-radius: 6px; }
.post__text { display: block; margin-top: 10px; font-size: 14px; line-height: 1.6; }
.post__imgs { display: flex; gap: 8px; margin-top: 10px; }
.post__img-box { width: 90px; height: 70px; border-radius: 8px; overflow: hidden; background: #DDD3C4; }
.post__img { width: 100%; height: 100%; }
.post__actions { display: flex; margin-top: 12px; }
.post__action { width: 33.3%; display: flex; align-items: center; gap: 6px; font-size: 14px; }
/* 找搭子 */
.drops { display: flex; gap: 10px; }
.drop { flex: 1; min-width: 0; height: 32px; padding: 0 10px; display: flex; align-items: center; gap: 4px; border: 1px solid var(--k-line2); border-radius: 8px; background: var(--k-paper); font-size: 14px; }
.cats { width: 100%; margin-top: 12px; white-space: nowrap; }
.cats__row { display: flex; gap: 10px; width: max-content; }
.cat { height: 30px; padding: 0 14px; border-radius: 999px; background: var(--k-paper2); border: 1px solid var(--k-line); font-size: 14px; display: flex; align-items: center; }
.cat.on { background: var(--k-red); border-color: var(--k-red); color: #fff; }
.vchip { height: 26px; padding: 0 10px; border: 1px solid var(--k-line2); border-radius: 999px; display: flex; align-items: center; gap: 5px; font-size: 12px; background: var(--k-paper); }
.vchip--sm { height: 24px; font-size: 11px; border-radius: 6px; }
.vchip--green { color: var(--k-green); background: var(--k-green-soft); border-color: transparent; }
.mate { margin-top: 12px; }
.mate__img { width: 96px; height: 106px; border-radius: 8px; flex: 0 0 auto; }
.mate__body { display: flex; flex-direction: column; gap: 4px; }
.mate__title { font-family: var(--k-serif); font-weight: 700; font-size: 16px; }
.mate__row { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--k-ink); }
.avs { display: flex; }
.avs__a { width: 26px; height: 26px; border-radius: 50%; border: 1.5px solid var(--k-paper); margin-left: -8px; }
.avs__a:first-child { margin-left: 0; }
.mate__tags { padding-left: 108px; }
/* 帖子详情 */
.hero { position: relative; margin: 4px 6px 0; height: 193px; border-radius: 12px; overflow: hidden; background: #DDD3C4; }
.hero__img { width: 100%; height: 100%; }
.hero__badge { position: absolute; right: 12px; top: 10px; height: 22px; padding: 0 9px; border-radius: 11px; background: rgba(60,50,45,.6); color: #fff; font-size: 13px; display: flex; align-items: center; }
.hero__dots { position: absolute; left: 0; right: 0; bottom: 8px; display: flex; justify-content: center; gap: 6px; }
.hero__dot { width: 6px; height: 6px; border-radius: 3px; background: rgba(255,255,255,.55); }
.hero__dot.on { width: 12px; background: #fff; }
.detail__title { display: block; margin-top: 16px; font-family: var(--k-serif); font-weight: 700; font-size: 20px; line-height: 1.4; }
.detail__body { display: block; margin-top: 10px; font-size: 14px; line-height: 1.85; color: var(--k-ink); }
.tag { height: 28px; padding: 0 10px; border: 1px solid var(--k-line2); border-radius: 6px; background: var(--k-paper); display: flex; align-items: center; gap: 4px; font-size: 13px; color: #4A5560; }
.rel { gap: 8px; }
.rel__card { padding: 10px 8px 8px; border-radius: 10px; border: 1px solid var(--k-line); display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.rel__card--blue { background: #ECEFF0; }
.rel__card--green { background: #E9EFE7; }
.rel__chip { align-self: flex-start; height: 20px; padding: 0 6px; border-radius: 4px; font-size: 11px; display: flex; align-items: center; }
.rel__chip--blue { background: var(--k-indigo-soft); color: var(--k-indigo); }
.rel__chip--green { background: var(--k-green-soft); color: var(--k-green); }
.rel__title { font-family: var(--k-serif); font-weight: 700; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rel__meta { font-size: 11px; color: var(--k-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rel__price { color: var(--k-red); font-weight: 700; font-size: 14px; font-family: Georgia, serif; }
.rel__status { display: flex; align-items: center; gap: 3px; font-size: 13px; font-weight: 700; }
.rel__status--green { color: var(--k-green); }
.rel__status--ochre { color: #B0782A; }
.rel__img { width: 100%; height: 64px; border-radius: 8px; margin-top: 2px; }
.actbar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 50; background: var(--k-paper); border-top: 1px solid var(--k-line); display: flex; flex-wrap: wrap; }
.actbar__item { width: 25%; height: 58px; display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 15px; }
.actbar__safe { width: 100%; height: var(--k-safe-bottom); }
/* 评论 */
.ctabs { margin-top: 4px; }
.ctabs .k-tabs__item { padding: 8px 16px 10px; font-size: 16px; }
.ctabs .k-tabs__item.active { font-family: var(--k-serif); font-weight: 700; font-size: 18px; }
.comments { padding: 0 16px calc(200px + var(--k-safe-bottom)); }
.comment { padding: 12px 0 14px; border-bottom: 1px solid var(--k-line); }
.comment__avatar { width: 32px; height: 32px; border-radius: 50%; flex: 0 0 auto; }
.comment__name { font-family: var(--k-serif); font-weight: 700; font-size: 15px; }
.comment__likes { font-size: 14px; }
.comment__text { display: block; margin-top: 8px; font-size: 14px; line-height: 1.7; }
.comment__reply { display: block; margin-top: 6px; font-size: 13px; color: var(--k-muted); }
.comment__nest { margin-top: 12px; padding: 10px 12px 12px; border-radius: 10px; background: var(--k-paper2); border: 1px solid var(--k-line); }
.author { height: 20px; padding: 0 6px; border-radius: 4px; background: var(--k-ochre-soft); color: var(--k-red); font-size: 12px; font-weight: 600; display: flex; align-items: center; }
.comment__more { color: var(--k-indigo); font-size: 14px; padding-left: 12px; }
.cbar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 50; background: var(--k-bg); border-top: 1px solid var(--k-line); padding: 12px 16px 0; }
.cbar__input { height: 44px; border-radius: 10px; }
.cbar__send { height: 44px; padding: 0 20px; border-radius: 8px; background: var(--k-red); color: #fff; font-size: 16px; font-weight: 600; display: flex; align-items: center; }
.cbar__ghost { height: 32px; padding: 0 30px; border: 1px solid var(--k-line2); border-radius: 6px; background: var(--k-paper); font-size: 13px; display: flex; align-items: center; }
.cbar__notice { margin-top: 12px; height: 38px; border: 1px solid var(--k-line2); border-radius: 10px; background: var(--k-paper); display: flex; align-items: center; justify-content: center; gap: 14px; font-size: 13px; color: var(--k-ink); }
.cbar__safe { height: calc(10px + var(--k-safe-bottom)); }
</style>
