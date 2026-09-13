<template>
  <view class="k-page profile">
    <k-topbar :title="titles[s - 1]" :back="s > 1" @back="s = 1" />

    <!-- 1 我的 -->
    <view v-if="s === 1" class="k-body k-pad-tab">
      <view class="card me" @click="s = 2">
        <image class="me__avatar" src="/static/media/profile-avatar.jpg" mode="aspectFill" />
        <view class="k-flex1 k-col">
          <text class="me__name">小袋鼠</text>
          <view class="k-row k-gap6 k-mt4"><text class="k-text k-muted">袋鼠编号：K0826</text><k-icon name="copy" :size="15" color="muted" :stroke="1.5" /></view>
          <view class="me__pill k-mt8" @click.stop="s = 3"><text>小袋鼠 · 1280 积分</text></view>
        </view>
        <image class="me__stamp" src="/static/media/profile-stamp.jpg" mode="aspectFit" />
        <k-icon name="chevron-right" :size="18" color="muted" />
      </view>

      <view class="card level k-mt12" @click="s = 3">
        <view class="k-flex1">
          <view class="k-between">
            <view class="k-row"><text class="k-title">当前等级：</text><text class="k-title level__name">小袋鼠</text></view>
            <text class="k-text k-muted">1280 / 2000</text>
          </view>
          <view class="bar k-mt10"><view class="bar__fill" style="width: 64%" /></view>
          <text class="k-meta k-mt8 b">再获得 720 积分可升级为「袋鼠」</text>
        </view>
        <image class="level__img" src="/static/media/profile-level-kangaroo.jpg" mode="aspectFit" />
      </view>

      <view class="card k-mt12 menu-card">
        <!-- Avoid short loop aliases: MP compiler also uses m for hoisted icon props. -->
        <view v-for="(menuItem, menuIndex) in menus" :key="menuItem.label" class="menu" :class="{ 'has-line': menuIndex < menus.length - 1 }" @click="open(menuItem)">
          <k-icon :name="menuItem.icon" :size="24" color="ink" :stroke="1.5" />
          <text class="menu__label k-flex1">{{ menuItem.label }}</text>
          <text class="menu__value k-small k-muted">{{ menuItem.value }}</text>
          <k-icon name="chevron-right" :size="16" color="muted" />
        </view>
      </view>

      <view class="card k-mt12 staff" @click="go(R.identity)">
        <view class="k-row k-gap10">
          <k-icon name="briefcase" :size="24" color="ink" :stroke="1.5" />
          <text class="menu__label k-flex1">员工工作台</text>
          <text class="k-small k-muted">管理员授权后可用</text>
          <k-icon name="lock" :size="18" color="muted" :stroke="1.5" />
        </view>
        <text class="k-small k-muted k-mt8 b">授权后可使用：排班、项目管理、数据看板等</text>
      </view>
    </view>

    <!-- 2 个人资料 -->
    <view v-else-if="s === 2" class="k-body k-pad-tab">
      <view class="card card--tight">
        <view class="avatar-box" @click="toast('更换头像')">
          <image class="avatar-box__img" src="/static/media/profile-avatar-lg.jpg" mode="aspectFill" />
          <text class="k-small k-muted k-mt6">更换头像</text>
        </view>
        <view v-for="f in fields" :key="f.label" class="frow" @click="toast(f.label)">
          <text class="frow__label">{{ f.label }}</text>
          <text class="frow__value">{{ f.value }}</text>
          <k-icon name="chevron-right" :size="16" color="muted" />
        </view>
        <view class="frow frow--intro" @click="toast('自我介绍')">
          <view class="k-flex1 k-col">
            <text class="frow__label">自我介绍</text>
            <text class="frow__intro k-pre">热爱手作与旅行，\n希望用双手创造更多美好。</text>
          </view>
          <view class="frow__side"><k-icon name="chevron-right" :size="16" color="muted" /><text class="k-meta">20/60</text></view>
        </view>
        <view class="frow" @click="s = 4">
          <text class="frow__label">手机号</text>
          <text class="frow__value">138****0826</text>
          <k-icon name="chevron-right" :size="16" color="muted" />
        </view>
        <view class="frow" @click="s = 4">
          <text class="frow__label">实名认证</text>
          <view class="k-row k-gap6"><view class="k-circle k-circle--green ok"><k-icon name="check" :size="11" color="white" :stroke="3" /></view><text class="frow__value k-green">已实名</text></view>
          <k-icon name="chevron-right" :size="16" color="muted" />
        </view>
      </view>
      <k-button block class="k-mt20" @click="go(R.resume + '?s=2')">编辑资料</k-button>
    </view>

    <!-- 3 六级积分 -->
    <view v-else-if="s === 3" class="k-body k-pad-tab">
      <view class="k-row"><text class="k-title">当前等级：</text><text class="k-title level__name">小袋鼠</text></view>
      <view class="levels">
        <view v-for="(n, i) in levelNodes" :key="i" :class="n.type === 'item' ? 'levels__item' : 'levels__gap'">
          <template v-if="n.type === 'item'">
            <view class="levels__ring" :class="{ cur: n.cur }"><image class="levels__img" :src="n.img" mode="aspectFit" /></view>
            <text class="levels__label" :class="{ cur: n.cur }">{{ n.label }}</text>
          </template>
          <template v-else>
            <view v-if="n.dot" class="levels__dot" />
            <k-icon v-else name="arrow-right" :size="15" color="#B98A4A" :stroke="1.6" />
          </template>
        </view>
      </view>
      <view class="k-row k-gap8 k-mt8"><text class="points">1280</text><text class="k-text k-muted">积分</text></view>
      <view class="k-between k-mt6"><text class="k-small k-muted">再获得 720 积分可升级为「袋鼠」</text><text class="k-text k-muted">1280 / 2000</text></view>
      <view class="bar k-mt8"><view class="bar__fill" style="width: 64%" /></view>

      <view class="card k-mt14">
        <text class="k-title">升级权益（袋鼠）</text>
        <view class="k-grid-4 k-mt12">
          <view v-for="b in benefits" :key="b.title" class="benefit">
            <view class="benefit__icon"><k-icon :name="b.icon" :size="22" color="#9A6A22" :stroke="1.6" /></view>
            <text class="benefit__title">{{ b.title }}</text>
            <text class="benefit__sub">{{ b.sub }}</text>
          </view>
        </view>
      </view>

      <view class="card k-mt12">
        <view class="k-between">
          <text class="k-title">积分明细</text>
          <view class="k-row k-gap2" @click="toast('全部记录')"><text class="k-small k-muted">全部记录</text><k-icon name="chevron-right" :size="14" color="muted" /></view>
        </view>
        <view v-for="r in records" :key="r.time" class="record">
          <view class="k-flex1 k-col k-gap2"><text class="k-text">{{ r.title }}</text><text class="k-meta">{{ r.time }}</text></view>
          <text class="record__pts">{{ r.pts }}</text>
        </view>
      </view>

      <view class="card k-mt12">
        <text class="k-title">如何获得积分</text>
        <view class="ways k-mt10">
          <view v-for="w in ways" :key="w.title" class="way">
            <k-icon :name="w.icon" :size="26" color="#9A6A22" :stroke="1.5" />
            <text class="way__title">{{ w.title }}</text>
            <text class="way__sub">{{ w.sub }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 4 账号与隐私设置 -->
    <view v-else class="k-body k-pad-tab">
      <view class="card card--tight">
        <view class="srow srow--tall has-line" @click="go(R.reminders)">
          <k-icon name="bell" :size="22" color="ink" :stroke="1.5" />
          <view class="k-flex1 k-col"><text class="srow__label">通知管理</text><text class="k-meta k-mt2">消息通知、声音提醒、系统通知等</text></view>
          <k-icon name="chevron-right" :size="16" color="muted" />
        </view>
        <view class="srow srow--tall" @click="toast('黑名单')">
          <k-icon name="user-round-x" :size="22" color="ink" :stroke="1.5" />
          <view class="k-flex1 k-col"><text class="srow__label">黑名单</text><text class="k-meta k-mt2">管理已屏蔽的用户</text></view>
          <k-icon name="chevron-right" :size="16" color="muted" />
        </view>
      </view>

      <view class="card card--group k-mt12">
        <text class="k-title">账号与安全</text>
        <view v-for="(r, i) in security" :key="r.label" class="srow" :class="{ 'has-line': i < security.length - 1 }" @click="toast(r.label)">
          <k-icon :name="r.icon" :size="22" color="ink" :stroke="1.5" />
          <text class="srow__label k-flex1">{{ r.label }}</text>
          <view v-if="r.green" class="k-row k-gap6"><view class="k-circle k-circle--green ok"><k-icon name="check" :size="11" color="white" :stroke="3" /></view><text class="k-small k-green">{{ r.value }}</text></view>
          <text v-else class="k-small k-muted">{{ r.value }}</text>
          <k-icon name="chevron-right" :size="16" color="muted" />
        </view>
      </view>

      <view class="card card--group k-mt12">
        <text class="k-title">隐私与授权</text>
        <view class="srow has-line" @click="toast('授权管理')">
          <k-icon name="settings" :size="22" color="ink" :stroke="1.5" />
          <text class="srow__label k-flex1">授权管理</text>
          <text class="k-small k-muted">管理第三方授权信息</text>
          <k-icon name="chevron-right" :size="16" color="muted" />
        </view>
        <view class="srow" @click="toast('导出数据')">
          <k-icon name="cloud-download" :size="22" color="ink" :stroke="1.5" />
          <text class="srow__label k-flex1">导出数据</text>
          <text class="k-small k-muted">下载个人数据副本</text>
          <k-icon name="chevron-right" :size="16" color="muted" />
        </view>
      </view>

      <view class="card card--group k-mt12">
        <text class="k-title">其他</text>
        <view class="srow" @click="toast('注销账号')">
          <k-icon name="circle-alert" :size="22" color="red" :stroke="1.5" />
          <text class="srow__label k-flex1 k-red">注销账号</text>
          <text class="k-small k-red">注销后将无法恢复，请谨慎操作</text>
          <k-icon name="chevron-right" :size="16" color="red" />
        </view>
      </view>

      <k-button type="secondary" block class="k-mt12 logout" @click="signOut">退出登录</k-button>
    </view>

    <k-tabbar active="profile" :mode="experience.mode" />
  </view>
</template>

<script setup>
import { experience, logout } from '@/common/experience.js'
const signOut = () => { logout(); relaunch(R.login) }
import { useScreen, go, relaunch, toast } from '@/common/screen.js'
import R from '@/common/routes.js'

const s = useScreen(4)
const titles = ['我的', '个人资料', '六级积分', '账号与隐私设置']

const menus = [
  { icon: 'file-badge', label: '我的简历', value: '完善度 85%', url: R.resume },
  { icon: 'file-text', label: '订单管理', value: '查看全部订单', url: R.orders },
  { icon: 'tent', label: '我的行程', value: '共 3 段行程', url: R.trip },
  { icon: 'star', label: '评价管理', value: '待评价 2 条', url: R.review },
  { icon: 'circle-check', label: '我的活动', value: '已报名 4 个', url: R.activityMine },
  { icon: 'bell', label: '我的提醒', value: '3 条未读', url: R.reminders },
  { icon: 'clipboard-list', label: '攻略申请', value: '我的攻略 1 篇', url: R.orders + '?s=4' }
]
const open = (m) => go(m.url)

const fields = [
  { label: '昵称', value: '小袋鼠' },
  { label: '性别', value: '女' },
  { label: '生日', value: '1999-06-18' },
  { label: '常驻城市', value: '大理' }
]

const levelNames = ['幼崽鼠', '小袋鼠', '袋鼠', '大袋鼠', '巨袋鼠', '袋鼠王']
const levelNodes = []
levelNames.forEach((label, i) => {
  if (i > 0) levelNodes.push({ type: 'gap', dot: i === 1 })
  levelNodes.push({ type: 'item', label, img: `/static/media/profile-level-${i + 1}.jpg`, cur: i === 1 })
})
const benefits = [
  { icon: 'shield-check', title: '接单优先权', sub: '获得更多推荐机会' },
  { icon: 'clipboard-check', title: '专属任务', sub: '解锁高收益任务' },
  { icon: 'crown', title: '专属标识', sub: '个人主页展示升级' },
  { icon: 'ticket', title: '兑换优惠券', sub: '更多优惠福利' }
]
const records = [
  { title: '完成订单：洱海边 · 温馨一居室', time: '2025-06-10 14:23', pts: '+280 积分' },
  { title: '收到好评（5星）', time: '2025-06-09 10:15', pts: '+50 积分' },
  { title: '参加活动：洱海旅拍协助', time: '2025-06-07 16:30', pts: '+40 积分' },
  { title: '每日签到', time: '2025-06-06 09:12', pts: '+5 积分' }
]
const ways = [
  { icon: 'clipboard-check', title: '完成订单', sub: '获取积分' },
  { icon: 'circle-check', title: '优质服务', sub: '获得好评' },
  { icon: 'alarm-clock', title: '参加活动', sub: '完成任务' },
  { icon: 'calendar-check', title: '每日签到', sub: '持续积累' },
  { icon: 'user-round-plus', title: '邀请好友', sub: '达成助力' }
]
const security = [
  { icon: 'file-pen', label: '手机号', value: '138****0826' },
  { icon: 'lock', label: '修改密码', value: '定期修改更安全' },
  { icon: 'monitor', label: '设备与登录', value: '管理登录设备与记录' },
  { icon: 'shield-check', label: '实名认证', value: '已实名', green: true }
]
</script>

<style scoped lang="scss">
.b { display: block; }
.k-mt2 { margin-top: 2px; }
.k-mt6 { margin-top: 6px; }
.k-mt10 { margin-top: 10px; }
.k-mt14 { margin-top: 14px; }
.card { background: var(--k-paper); border: 1px solid var(--k-line); border-radius: 14px; padding: 14px; }
.card--tight { padding: 0 14px; }
.card--group { padding: 12px 14px 0; }
.bar { height: 6px; border-radius: 3px; background: #EDE6DA; overflow: hidden; }
.bar__fill { height: 100%; border-radius: 3px; background: #C58F3F; }

/* s1 */
.me { display: flex; align-items: center; gap: 14px; padding: 16px 12px 16px 14px; position: relative; }
.me__avatar { width: 82px; height: 82px; border-radius: 50%; flex: 0 0 auto; }
.me__name { font-family: var(--k-serif); font-weight: 700; font-size: 21px; line-height: 1.3; }
.me__pill { align-self: flex-start; height: 24px; padding: 0 12px; border-radius: 999px; background: linear-gradient(90deg, #C79246, #A9752F); color: #FFF8EC; font-size: 14px; display: flex; align-items: center; }
.me__stamp { position: absolute; right: 42px; top: 14px; width: 80px; height: 52px; }
.level { display: flex; align-items: center; gap: 10px; padding: 14px 12px 14px 14px; }
.level__name { color: #7A4E1E; }
.level__img { width: 54px; height: 54px; flex: 0 0 auto; }
.menu-card { padding: 0 12px 0 14px; }
.menu { display: flex; align-items: center; flex-wrap: nowrap; gap: 10px; width: 100%; height: 46px; }
.menu.has-line { border-bottom: 1px solid var(--k-line); }
.menu__label { font-family: var(--k-serif); font-weight: 700; font-size: 16px; white-space: nowrap; }
.menu__value { flex: 0 0 auto; white-space: nowrap; }
.staff { padding: 14px 12px 14px 14px; }

/* s2 */
.avatar-box { display: flex; flex-direction: column; align-items: center; padding: 20px 0 18px; border-bottom: 1px solid var(--k-line); }
.avatar-box__img { width: 80px; height: 80px; border-radius: 50%; }
.frow { display: flex; align-items: center; gap: 8px; min-height: 49px; border-bottom: 1px solid var(--k-line); }
.frow:last-child { border-bottom: 0; }
.frow__label { flex: 1; font-size: 16px; color: var(--k-ink); }
.frow__value { font-size: 16px; color: var(--k-ink); }
.frow--intro { align-items: center; padding: 12px 0 10px; }
.frow--intro .frow__label { flex: 0 0 auto; }
.frow__intro { margin-top: 6px; font-size: 15px; line-height: 1.7; }
.frow__side { display: flex; flex-direction: column; align-items: flex-end; gap: 12px; align-self: stretch; justify-content: space-between; padding-top: 22px; }
.ok { width: 16px; height: 16px; }

/* s3 */
.levels { display: flex; align-items: flex-start; margin-top: 10px; }
.levels__item { width: 50px; display: flex; flex-direction: column; align-items: center; gap: 4px; }
.levels__gap { flex: 1; display: flex; align-items: center; justify-content: center; height: 50px; }
.levels__ring { width: 50px; height: 50px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
.levels__ring.cur { border: 1.5px solid #C0975A; background: var(--k-paper); }
.levels__img { width: 40px; height: 44px; }
.levels__label { font-size: 12px; color: var(--k-muted); white-space: nowrap; }
.levels__label.cur { color: var(--k-ink); font-weight: 700; }
.levels__dot { width: 12px; height: 12px; border-radius: 50%; background: var(--k-red); border: 3px solid #E9C6BB; box-sizing: content-box; }
.levels__item { width: 47px; }
.levels__ring { width: 46px; height: 46px; }
.levels__img { width: 38px; height: 41px; }
.benefit { min-width: 0; overflow: hidden; }
.points { color: var(--k-red); font-family: Georgia, "Times New Roman", serif; font-weight: 700; font-size: 30px; line-height: 1; }
.benefit { display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; }
.benefit__icon { width: 40px; height: 40px; border-radius: 50%; border: 1.5px solid #B98A4A; display: flex; align-items: center; justify-content: center; margin-bottom: 4px; }
.benefit__title { font-size: 13px; font-weight: 700; color: var(--k-ink); white-space: nowrap; }
.benefit__sub { font-size: 10px; color: var(--k-muted); white-space: nowrap; }
.record { display: flex; align-items: center; gap: 8px; padding: 9px 0 2px; }
.record__pts { color: var(--k-red); font-size: 15px; font-weight: 600; }
.ways { display: flex; justify-content: space-between; }
.way { display: flex; flex-direction: column; align-items: center; gap: 3px; width: 60px; text-align: center; }
.way__title { font-size: 13px; font-weight: 700; color: var(--k-ink); margin-top: 4px; white-space: nowrap; }
.way__sub { font-size: 11px; color: var(--k-muted); white-space: nowrap; }

/* s4 */
.srow { display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 0 0 0 2px; }
.srow--tall { min-height: 64px; }
.srow.has-line { border-bottom: 1px solid var(--k-line); }
.srow__label { font-family: var(--k-serif); font-weight: 700; font-size: 15px; }
.card--group .srow:first-of-type { margin-top: 2px; }
.logout { font-family: var(--k-serif); font-size: 17px; }
</style>
