<template>
  <!-- #ifdef MP-WEIXIN -->
  <page-meta :page-style="aiOpen ? 'overflow: hidden' : ''" />
  <!-- page-meta 必须是页面第一个节点。AI袋鼠弹层开着时锁住页面滚动（弹层里的对话区是 scroll-view，不能用 catchtouchmove 拦）；网页版由弹层自己锁 body -->
  <!-- #endif -->
  <view class="k-page profile" :class="[$userSurface, { 'profile--membership': s === 3, 'profile--plain': s === 2 || s === 4, 'profile--home': s === 1 }]">
    <!-- 「我的」首屏不挂返回拦截：之前首屏也带 custom-back，从底栏进来时安卓返回键被拦下又什么都不做，退不出小程序。
         两个顶栏用 v-if 分开，切屏时拦截跟着挂上 / 撤掉 -->
    <k-topbar v-if="s === 1" :title="titles[0]" :bg="navSolid ? 'var(--k-page)' : 'var(--k-red-soft)'" />
    <k-topbar v-else :title="titles[s - 1]" back custom-back @back="onBack" />

    <view v-if="s === 1 && staffMode" class="k-body k-pad-tab staff-account">
      <view class="card staff-account__identity"><image :src="avatar" mode="aspectFill" /><view><text>{{ account.nickname || (merchantStaff ? '商家账号' : '员工账号') }}</text><text class="k-meta">{{ staffRoleLine }}</text></view></view>
      <!-- 11-18 第三轮返修：团队报表、保险账户并成一张卡，和「我的」常用入口同一种两行列表行（图标 18 + 名字 14 + 下面 12 号灰字 + 箭头） -->
      <view v-if="teamReportsAllowed || (signedIn && (merchantStaff || insuranceAccountVisible))" class="mine-links">
        <view v-if="teamReportsAllowed" class="mrow" hover-class="k-press" @click="go('/pages/profile/team-reports')"><k-icon name="file-text" :size="18" color="ink2"/><view class="mrow__text"><text class="mrow__label">团队报表</text><text class="mrow__hint">各城市已提交报表</text></view><k-icon name="chevron-right" :size="12" color="muted" /></view>
        <view v-if="signedIn && (merchantStaff || insuranceAccountVisible)" class="mrow" hover-class="k-press" @click="go('/pages/staff/insurance-account?tab=account')"><k-icon name="shield-check" :size="18" color="ink2"/><view class="mrow__text"><text class="mrow__label">保险账户</text><text class="mrow__hint">缴费、退费与余额</text></view><k-icon name="chevron-right" :size="12" color="muted" /></view>
      </view>
      <view class="staff-mediation"><MediationEntry /></view>
      <view class="mine-links staff-account__links"><view class="mrow" hover-class="k-press" @click="go(R.staff)"><k-icon name="store" :size="18" color="ink2"/><text class="mrow__label">{{ merchantStaff ? '发布与进度' : '门店工作台' }}</text><k-icon name="chevron-right" :size="12" color="muted" /></view><view v-if="merchantStaff" class="mrow" hover-class="k-press" @click="go(R.support)"><k-icon name="message-circle-heart" :size="18" color="ink2"/><text class="mrow__label">体验反馈</text><k-icon name="chevron-right" :size="12" color="muted" /></view><view class="mrow" hover-class="k-press" @click="s = 2"><k-icon name="user-round" :size="18" color="ink2"/><text class="mrow__label">账号资料</text><k-icon name="chevron-right" :size="12" color="muted" /></view><view class="mrow" hover-class="k-press" @click="s = 4"><k-icon name="settings" :size="18" color="ink2"/><text class="mrow__label">设置</text><k-icon name="chevron-right" :size="12" color="muted" /></view><view class="mrow" hover-class="k-press" @click="openStaff"><k-icon name="arrow-left-right" :size="18" color="ink2"/><text class="mrow__label">返回用户首页</text><k-icon name="chevron-right" :size="12" color="muted" /></view></view>
    </view>
    <!-- 1 我的 -->
    <view v-else-if="s === 1" class="k-body k-pad-tab mine">
      <!-- 登录中途失效（本机还留着令牌、服务端已不认）：账号被清掉后下面的卡片都按 signedIn 收起，之前整屏只剩顶栏和底栏。
           现在显示「去登录」：登录页压在本页上面，登录完退回这里重新读取。冷启动恢复登录态时不显示（只在登录过又失效时出现） -->
      <view v-if="loginLost && !signedIn" class="card relogin">
        <text class="relogin__title">登录已失效</text>
        <text class="relogin__hint">重新登录后，可以继续查看订单、积分和个人资料</text>
        <k-button block class="k-mt12" @click="go(R.login)">去登录</k-button>
      </view>
      <view v-if="signedIn" class="me" hover-class="k-press-s" @click="s = 2">
        <image class="me__avatar" :src="avatar" mode="aspectFill" />
        <view class="k-flex1 k-col me__info">
          <view class="k-row k-gap6"><text class="me__name">{{ nickname }}</text><k-chip v-if="me?.honoraryTitle" tone="ochre">{{ me.honoraryTitle }}</k-chip></view>
          <view class="me__no" hover-class="k-press" :hover-stop-propagation="true" @click.stop="copyMemberNo"><text>会员编号 {{ memberNo }}</text><k-icon name="copy" :size="12" color="muted" /></view>
        </view>
        <view class="me__edit" hover-class="k-press" :hover-stop-propagation="true" @click.stop="s = 2"><view class="me__edit-pill"><text>编辑资料</text></view></view>
      </view>

      <!-- 会员等级、可用积分和升级进度使用账号真实数据，0 积分时进度条不填充。 -->
      <view v-if="signedIn" class="card member-card" :hover-class="membershipReady ? 'k-press-s' : 'none'" @click="openMember">
        <template v-if="membershipReady">
          <view class="member-mascot"><level-icon :level="currentLevel" :size="44" /></view>
          <view class="member-body">
            <text class="member-level level__name">{{ levelName }}</text>
            <view class="member-points"><text class="member-points__num">{{ points }}</text><text class="member-points__unit">可用积分</text></view>
          </view>
          <view class="member-actions">
            <view class="member-cta" hover-class="k-press" :hover-stop-propagation="true" @click.stop="go(R.memberBenefits)"><text>会员权益</text><k-icon name="chevron-right" :size="12" color="muted" /></view>
            <view class="member-cta" hover-class="k-press" :hover-stop-propagation="true" @click.stop="go('/pages/governance/badges')"><text>我的勋章</text><k-icon name="chevron-right" :size="12" color="muted" /></view>
          </view>
        </template>
        <view v-else class="member-state"><text>{{ profileLoading ? '正在读取会员信息…' : (profileError || '会员信息暂不可用') }}</text><button v-if="!profileLoading" class="member-link" @click.stop="retryProfile">重新加载</button></view>
      </view>

      <view v-if="teamReportsAllowed || (signedIn && (merchantStaff || insuranceAccountVisible))" class="mine-links">
      <view v-if="teamReportsAllowed" class="mrow" hover-class="k-press" @click="go('/pages/profile/team-reports')"><k-icon name="file-text" :size="18" color="ink2"/><view class="mrow__text"><text class="mrow__label">团队报表</text><text class="mrow__hint">各城市已提交报表</text></view><k-icon name="chevron-right" :size="12" color="muted" /></view>
      <view v-if="signedIn && (merchantStaff || insuranceAccountVisible)" class="mrow" hover-class="k-press" @click="go('/pages/staff/insurance-account?tab=account')"><k-icon name="shield-check" :size="18" color="ink2"/><view class="mrow__text"><text class="mrow__label">保险账户</text><text class="mrow__hint">缴费、退费与余额</text></view><k-icon name="chevron-right" :size="12" color="muted" /></view>
      </view>

      <!-- 按订单、工作、内容分组，使用已有业务入口。员工授权由服务端校验。 -->
      <!-- 11-18 第三轮返修：四组宫格合进一张白卡，组标题 13 / 500 灰字，组和组之间发丝线 + 16 留白（纠纷调解已挪出去自己一组） -->
      <view v-if="signedIn" class="card grid-card grid-card--all">
        <view v-for="groupItem in groups" :key="groupItem.title" class="grid-wrap">
          <view class="grid-group">
            <text class="grid-card__title">{{ groupItem.title }}</text>
            <view class="grid" :class="{ 'grid--3': groupItem.items.length === 3, 'grid--2': groupItem.items.length === 2 }">
              <view v-for="cellItem in groupItem.items" :key="cellItem.label" class="cell" hover-class="k-press" @click="open(cellItem)">
                <view class="cell__icon">
                  <k-icon :name="CELL_LINE[cellItem.label]" :art="cellItem.art" :size="27" color="red" />
                  <text v-if="cellItem.badge" class="cell__badge">{{ cellItem.badge }}</text>
                </view>
                <text class="cell__label">{{ cellItem.label }}</text>
              </view>
            </view>
          </view>
        </view>
      </view>

      <!-- 员工工作台（2026-10-18 主人：只有被授权的人才看到）：有生效中的员工授权（kg_staff_grant）的账号才显示，
           员工身份下这是切回用户身份的唯一入口；没有授权的普通用户「我的」里不出现这张卡。单行白卡，两种状态文字；11-18 第三轮和常用入口同一种行 -->
      <view v-if="hasStaffAccess" class="card staff" hover-class="k-press-s" @click="openStaff">
        <k-icon name="briefcase-business" :size="18" color="ink2" />
        <text class="staff__title">{{ onlyMerchant ? '商家工作台' : '员工工作台' }}</text>
        <text class="staff__state">{{ staffEntering ? '正在确认权限…' : (staffMode ? '员工身份 · 切换身份' : '已授权 · 点击进入') }}</text>
        <k-icon name="chevron-right" :size="12" color="muted" />
      </view>
    </view>

    <!-- 2 个人资料 -->
    <!-- 11-18 第三轮：拆成两张卡 —— 上卡「账号资料」标题在最上面 → 头像 → 昵称、自我介绍（名字在输入框上面）→ 右下角「保存」描边小胶囊，下卡性别 / 生日 / 城市 / 手机号 / 实名一列行；
         之前一颗满宽大按钮夹在输入框和下面的行中间，把一张卡切成两截 -->
    <view v-else-if="s === 2" class="k-body k-pad-tab prof">
      <view class="card card--tight prof__account">
        <view class="acct__head"><text class="acct__title">账号资料</text><text class="wechat-profile-hint">点击头像选择微信头像，点击昵称输入框使用微信昵称；昵称填写后请保存。</text></view>
        <!-- #ifdef MP-WEIXIN -->
        <button class="avatar-box avatar-wechat" open-type="chooseAvatar" :disabled="busy" @chooseavatar="chooseWechatAvatar" @error="onAvatarError"><image class="avatar-box__img" :src="avatarLarge" mode="aspectFill"/><text class="k-small k-muted k-mt6">{{busy ? '保存中…' : '选择微信头像'}}</text></button>
        <button class="avatar-album" :disabled="busy" @click="changeAvatar">从相册选头像</button>
        <!-- #endif -->
        <!-- #ifndef MP-WEIXIN -->
        <view class="avatar-box" hover-class="k-press" @click="changeAvatar"><image class="avatar-box__img" :src="avatarLarge" mode="aspectFill"/><text class="k-small k-muted k-mt6">更换头像</text></view>
        <!-- #endif -->
        <!-- 2026-11-03 主人：简化 —— 昵称、自我介绍在「账号资料」区直接输入 + 一个「保存」钮（原来各弹一个系统输入框）。
             自我介绍不打字时用普通块显示（微信里 textarea 是原生层，会盖住底部导航） -->
        <form class="acct" @submit="saveDraft">
          <view class="acct__row"><text class="acct__label">昵称</text><view class="k-input acct__input"><input type="nickname" name="nickname" :value="draft.nickname" @input="draft.nickname=$event.detail.value" @blur="draft.nickname=$event.detail.value" maxlength="16" placeholder="点击使用微信昵称或自行填写" placeholder-class="k-placeholder" /></view></view>
          <view class="acct__row acct__row--top"><text class="acct__label">自我介绍</text><view class="k-input acct__input acct__area"><textarea v-if="editingIntro" v-model="draft.intro" class="acct__textarea" maxlength="60" placeholder="60 字以内，别写联系方式" placeholder-class="k-placeholder" :focus="true" auto-focus @blur="draft.intro = $event.detail.value; editingIntro = false" /><view v-else class="acct__idle" @click="editingIntro = true"><text :class="{ 'k-placeholder': !draft.intro }">{{ draft.intro || '60 字以内，别写联系方式' }}</text></view><text class="acct__count">{{ draft.intro.length }}/60</text></view></view>
          <view class="acct__save"><button class="profile-save" form-type="submit" :disabled="busy">{{busy ? '保存中…' : '保存账号资料'}}</button></view>
        </form>
      </view>
      <view class="card card--tight prof__fields">
        <!-- 没填的项一律写「未填写」（浅色字），手机号没绑写「未绑定」：之前只有性别写「未填写」，生日、常驻城市、自我介绍空着 -->
        <view v-for="f in fields" :key="f.label" class="frow" hover-class="k-press" @click="editField(f)">
          <text class="frow__label">{{ f.label }}</text>
          <text class="frow__value" :class="{ 'frow__value--empty': f.empty }">{{ f.value }}</text>
          <k-icon name="chevron-right" :size="12" color="muted" />
        </view>
        <view class="frow" hover-class="k-press" @click="bindPhone">
          <text class="frow__label">手机号</text>
          <text class="frow__value" :class="{ 'frow__value--empty': !phone }">{{ phoneShown }}</text>
          <k-icon name="chevron-right" :size="12" color="muted" />
        </view>
        <!-- 2026-11-03 主人：简化 —— 实名认证是页面内的折叠区：点一行展开，两个输入框 + 一个「提交认证」（原来姓名、身份证号各弹一个系统输入框）；
             已认证 / 服务没开通时展开只是一句说明，不弹窗 -->
        <view class="frow" hover-class="k-press" @click="toggleReal">
          <text class="frow__label">实名认证</text>
          <view class="k-row k-gap6"><view v-if="realNameVerified" class="k-circle k-circle--green ok"><k-icon name="check" :size="12" color="white" /></view><text class="frow__value" :class="realNameVerified ? 'k-green' : 'frow__value--empty'">{{ realNameLabel }}</text></view>
          <k-icon :name="realOpen ? 'chevron-up' : 'chevron-down'" :size="12" color="muted" />
        </view>
        <view v-if="realOpen" class="real">
          <text v-if="realNameVerified" class="real__hint">已完成实名认证：{{ realNameLabel }}。证件号不会明文保存，平台只留后四位与不可还原的摘要。</text>
          <text v-else-if="!(me && me.realNameEnabled)" class="real__hint">实名核验服务尚未开通，开通后可在这里完成认证。</text>
          <template v-else>
            <view class="acct__row"><text class="acct__label">姓名</text><view class="k-input acct__input"><input v-model="realForm.name" maxlength="20" placeholder="身份证上的姓名" placeholder-class="k-placeholder" /></view></view>
            <view class="acct__row"><text class="acct__label">身份证号</text><view class="k-input acct__input"><input v-model="realForm.idNo" type="idcard" maxlength="18" placeholder="18 位身份证号" placeholder-class="k-placeholder" /></view></view>
            <text class="real__hint">证件号只用于核验，不会明文保存，平台只留后四位与不可还原的摘要</text>
            <view class="acct__save"><k-button block :disabled="realBusy" :label="realBusy ? '认证中…' : '提交认证'" @click="submitRealName" /></view>
          </template>
        </view>
        <!-- 首屏资料卡上的「编辑资料」进的就是这一屏（标题也叫「编辑资料」）；简历的基本信息另在简历里改，这里只留一行浅色文字链接，
             之前是一个整宽大按钮，一页里两种「编辑」分不清 -->
        <view v-if="recruitmentEnabled" class="resume-link" hover-class="k-press" @click="go(R.resume + '?s=2')"><text>报名用的简历资料，去简历里修改</text><k-icon name="chevron-right" :size="12" color="muted" /></view>
      </view>
    </view>

    <!-- 3 会员信息与成长积分 -->
    <view v-else-if="s === 3" class="k-body k-pad-tab mi">
      <view v-if="!membershipReady" class="card member-state"><text>{{ profileLoading ? '正在读取会员信息…' : (profileError || '会员信息暂不可用') }}</text><button v-if="!profileLoading" class="member-link" @click="retryProfile">重新加载</button></view>
      <template v-else>
      <!-- 2026-10-17 按主人样稿改版：顶部暖卡 → 升级进度 → 会员等级 → 我的权益 → 赚取积分 → 积分明细 → 积分规则。
           等级名和门槛、每级权益、每项积分都来自服务端（后台「会员等级」「会员店铺权益」「参数设置」），不写死样稿里的数 -->
      <view class="card mi-hero">
        <view class="mi-hero__identity">
          <level-icon :level="currentLevel" :size="64" />
          <view class="mi-hero__body">
            <view class="mi-hero__level-row"><text class="mi-hero__level level__name">{{ levelName }}</text><text class="mi-hero__tag">袋鼠会员</text></view>
            <text class="mi-hero__nick">{{ nickname }}</text>
          </view>
        </view>
        <view class="mi-hero__row">
          <view class="mi-hero__pts"><text>当前积分</text><text class="mi-hero__num">{{ points }}</text></view>
          <view class="mi-hero__rules" hover-class="k-press" @click="jumpTo('#mi-rules')"><view class="mi-hero__rules-pill"><text>积分规则</text></view></view>
        </view>
      </view>

      <view class="card mi-card">
        <view class="mi-head">
          <text class="mi-title">升级进度</text>
          <view class="mi-link" hover-class="k-press" @click="jumpTo('#mi-levels')"><text>查看等级</text><k-icon name="chevron-right" :size="12" color="muted" /></view>
        </view>
        <view class="mi-bar"><view v-if="pointsPercent" class="mi-bar__fill" :style="{ width: pointsPercent + '%' }" /></view>
        <view class="mi-prog"><text v-if="progressCount" class="mi-prog__count">{{ progressCount }}</text><text class="mi-prog__tip">{{ upgradeLine }}</text></view>
        <text v-if="pointsLedgerText" class="member-note mi-ledger">{{ pointsLedgerText }}</text>
      </view>

      <!-- 会员等级：一行排开后台设置的全部等级（现在是 6 级），徽章下面是名字和所需积分；当前等级的名字是实心胶囊，没达到的灰显 -->
      <view id="mi-levels" class="mi-sec"><text class="mi-title">会员等级</text></view>
      <scroll-view class="mi-level-scroll" scroll-x :show-scrollbar="false" :scroll-into-view="'member-level-' + currentLevel">
        <view class="levels" :style="{ width: levelNodes.length * 88 + 'px' }">
          <view class="levels__track"><view class="levels__fill" :style="{ width: levelReach + '%' }" /></view>
          <view v-for="(levelItem, levelIndex) in levelNodes" :key="levelIndex" :id="'member-level-' + levelItem.level" class="levels__item" :class="{ selected: selectedPerkLevel === levelItem.level, 'is-cur': levelItem.cur }" role="button" :aria-label="levelItem.label + '权益'" @click="selectPerk(levelItem.level)">
            <view class="levels__ring" :class="{ cur: levelItem.cur }"><level-icon :level="levelItem.level" :size="48" :off="levelItem.off" /></view>
            <text class="levels__label" :class="{ cur: levelItem.cur }">{{ levelItem.label }}</text>
            <text class="levels__pts">{{ levelItem.min }}<text class="levels__ji">积</text>分</text>
          </view>
        </view>
      </scroll-view>

      <button v-if="me.executionEnabled" class="mi-benefit-detail__shops" @click="go('/pages/profile/point-mall')"><text class="mi-row__label">积分商城</text><k-icon name="chevron-right" :size="12" color="muted" /></button>
      <button v-if="me.executionEnabled" class="mi-benefit-detail__shops" @click="go('/pages/profile/member-wallet')"><text class="mi-row__label">我的权益</text><text class="mi-row__hint">领取、兑换与使用记录</text><k-icon name="chevron-right" :size="12" color="muted" /></button>
      <!-- 选择等级查看后台配置的完整权益，保留房型、次数等使用条件。 -->
      <view class="mi-sec">
        <text class="mi-title">等级权益</text>
        <view class="mi-link" hover-class="k-press" @click="go(R.memberBenefits)"><text>合作店权益</text><k-icon name="chevron-right" :size="12" color="muted" /></view>
      </view>
      <text class="mi-level-hint">点击上方等级，查看对应权益</text>
      <view v-if="selectedPerk" class="mi-benefit-detail">
        <view class="mi-benefit-detail__head">
          <level-icon :level="selectedPerk.level" :size="46" />
          <view class="mi-benefit-detail__identity"><text class="mi-benefit-detail__title">{{ selectedPerk.levelName }}</text><text class="mi-benefit-detail__status">{{ selectedPerk.cur ? '当前等级' : (selectedPerk.off ? '达到 ' + selectedPerk.minPoints + ' 积分解锁' : '已达到该等级') }}</text></view>
        </view>
        <view v-for="(lineItem, lineIndex) in selectedPerk.lines" :key="lineIndex" class="mi-benefit-detail__line"><k-icon name="check" :size="16" color="red" /><text>{{ lineItem }}</text></view>
        <text v-if="!selectedPerk.lines.length" class="mi-level-hint">该等级权益说明待补充</text>
        <button v-if="selectedPerk.shops" class="mi-benefit-detail__shops" @click="go(R.memberBenefits)">查看 {{ selectedPerk.shops }} 项合作店权益<k-icon name="chevron-right" :size="12" color="muted" /></button>
      </view>

      <!-- 赚取积分：服务端只下发真的会发积分的事（分数来自参数设置），两项一张白卡；一次性的做完了显示「已完成」 -->
      <view v-if="taskGroups.length" class="mi-sec"><text class="mi-title">赚取积分</text></view>
      <!-- 11-18 第三轮返修：所有任务放进一张白卡、一项一行（图标 18 + 名字 14 / 600 + 右边积分 + 28 高按钮，说明在名字下面占满整行），不再两项一张卡、说明缩在图标右边被挤成孤字 -->
      <view v-if="taskGroups.length" class="card mi-tasks-card">
      <view v-for="(taskGroup, taskGroupIndex) in taskGroups" :key="taskGroupIndex" class="mi-tasks">
        <view v-for="taskItem in taskGroup" :key="taskItem.key" class="mi-task">
          <view class="mi-task__icon"><k-icon :name="taskItem.icon" :size="20" color="red" /></view>
          <view class="mi-task__main">
            <view class="mi-task__top"><text class="mi-task__title">{{ taskItem.title }}</text><text v-if="taskItem.points" class="mi-task__pts">{{ taskItem.points }}</text></view>
            <text v-if="taskItem.sub" class="mi-task__sub">{{ taskItem.sub }}</text>
          </view>
          <view v-if="taskItem.done" class="mi-task__go mi-task__go--done"><view class="mi-task__btn done"><text>已完成</text></view></view>
          <view v-else class="mi-task__go" hover-class="k-press" @click="doTask(taskItem)"><view class="mi-task__btn"><text>去完成</text></view></view>
        </view>
      </view>
      </view>

      <view class="card k-mt12">
        <view class="k-between">
          <text class="k-title">积分明细</text>
          <button v-if="recordTotal > records.length" class="member-link" :disabled="recordsLoading" @click="moreRecords"><text>{{ recordsLoading ? '加载中…' : '更多记录' }}</text><k-icon name="chevron-right" :size="14" color="muted" /></button>
        </view>
        <view v-if="!records.length" class="mi-empty"><view class="mi-empty__icon"><k-icon name="coins" :size="32" color="red" /></view><text class="member-note b">还没有积分记录。完成入住评价、发布旅居攻略或邀请朋友，获得的积分都会记在这里。</text></view>
        <view v-for="(r, i) in records" :key="i" class="record">
          <view class="k-flex1 k-col k-gap2"><text class="k-text">{{ r.title }}</text><text class="k-meta">{{ r.time }}</text></view>
          <text class="record__pts" :class="{ 'record__pts--out': String(r.pts).trim().startsWith('-') }">{{ r.pts }}</text>
        </view>
      </view>

      <!-- 积分规则：纸张质感的卡片，一条一行编 01、02…；每条的分数都是服务端按参数设置拼好的（ruleRows），老接口没有时按 note 分行 -->
      <view id="mi-rules" class="mi-rules">
        <text class="mi-rules__title">积分规则</text>
        <view v-for="(ruleItem, ruleIndex) in ruleRows" :key="ruleIndex" class="mi-rule">
          <text class="mi-rule__no">{{ ruleItem.no }}</text>
          <view class="mi-rule__body"><text v-if="ruleItem.title" class="mi-rule__name">{{ ruleItem.title }}：</text><text class="mi-rule__text">{{ ruleItem.text }}</text></view>
        </view>
      </view>
      </template>
    </view>

    <!-- 4 账号与隐私设置 -->
    <!-- 11-18 第三轮：分组名从卡里挪到卡片上方（12 / 500 灰字，上 20 下 8），卡里只留行；第一组不写组名 -->
    <view v-else class="k-body k-pad-tab settings">
      <view class="card card--tight">
        <view class="srow srow--tall has-line" hover-class="k-press" @click="go(R.reminders + '?s=4')">
          <k-icon name="bell" :size="18" color="ink2" />
          <view class="k-flex1 k-col"><text class="srow__label">通知管理</text><text class="k-meta k-mt2">消息通知、声音提醒、系统通知等</text></view>
          <k-icon name="chevron-right" :size="12" color="muted" />
        </view>
        <view class="srow srow--tall has-line" hover-class="k-press" @click="openBlocks">
          <k-icon name="user-round-x" :size="18" color="ink2" />
          <view class="k-flex1 k-col"><text class="srow__label">黑名单</text><text class="k-meta k-mt2">管理已屏蔽的用户</text></view>
          <k-icon name="chevron-right" :size="12" color="muted" />
        </view>
        <!-- 谁可以私信我（2026-10-11）：所有人（默认）/ 我关注的人 / 互相关注的人 -->
        <view v-if="privateChatEnabled" class="srow srow--tall" hover-class="k-press" @click="pickDmPrivacy">
          <k-icon name="message-circle" :size="18" color="ink2" />
          <!-- 说明拆成两段：320 宽右边显示「互相关注的人」时放不下，在「不满足条件的人 / 发不起私信」之间换行，不再断成「发不 / 起私信」 -->
          <view class="k-flex1 k-col"><text class="srow__label">谁可以私信我</text><view class="srow__sub k-mt2"><text class="k-meta">不满足条件的人</text><text class="k-meta">发不起私信</text></view></view>
          <text class="k-small k-muted">{{ dmLabel }}</text>
          <k-icon name="chevron-right" :size="12" color="muted" />
        </view>
      </view>

      <text class="set-group">账号与安全</text>
      <view class="card card--group">
        <view v-for="(r, i) in security" :key="r.label" class="srow" :class="{ 'has-line': i < security.length - 1, 'srow--desc': r.key === 'devices' }" hover-class="k-press" @click="openSecurity(r)">
          <k-icon :name="r.icon" :size="18" color="ink2" />
          <view class="srow__main"><text class="srow__label">{{ r.label }}</text>
          <view v-if="r.green" class="k-row k-gap6 srow__hint"><view class="k-circle k-circle--green ok"><k-icon name="check" :size="12" color="white" /></view><text class="k-small k-green">{{ r.value }}</text></view>
          <text v-else class="k-small k-muted srow__hint">{{ r.value }}</text></view>
          <k-icon name="chevron-right" :size="12" color="muted" />
        </view>
      </view>

      <view v-if="staffMode && merchantStaff" class="card card--group">
        <view class="srow" hover-class="k-press" @click="exitMerchant">
          <k-icon name="log-out" :size="18" color="ink2" />
          <text class="srow__label k-flex1">退出合作商家</text>
          <k-icon name="chevron-right" :size="12" color="muted" />
        </view>
      </view>

      <text class="set-group">隐私与授权</text>
      <view class="card card--group">
        <view class="srow srow--desc has-line" hover-class="k-press" @click="openAuthorizations">
          <k-icon name="settings" :size="18" color="ink2" />
          <view class="srow__main"><text class="srow__label">授权管理</text><text class="k-small k-muted srow__hint">管理第三方授权信息</text></view>
          <k-icon name="chevron-right" :size="12" color="muted" />
        </view>
        <view class="srow srow--desc" hover-class="k-press" @click="exportData">
          <k-icon name="cloud-download" :size="18" color="ink2" />
          <view class="srow__main"><text class="srow__label">导出数据</text><text class="k-small k-muted srow__hint">下载个人数据副本</text></view>
          <k-icon name="chevron-right" :size="12" color="muted" />
        </view>
      </view>

      <text class="set-group">其他</text>
      <view class="card card--group">
        <view class="srow srow--desc" hover-class="k-press" @click="deactivate">
          <k-icon name="circle-alert" :size="18" color="alert" />
          <view class="srow__main"><text class="srow__label k-alert">注销账号</text><text class="k-small k-muted srow__hint">注销后将无法恢复，请谨慎操作</text></view>
          <k-icon name="chevron-right" :size="12" color="muted" />
        </view>
      </view>

      <k-button type="secondary" block class="k-mt12 logout" @click="signOut">退出登录</k-button>
    </view>

    <k-tabbar active="profile" :mode="experience.mode" />
    <!-- 更多服务 → AI袋鼠：在本页底部弹出来聊（「我的」情境：报名 / 订单 / 评价的真实数据问答、转人工） -->
    <k-ai-sheet :show="aiOpen" ctx="profile" @close="aiOpen = false" />
  </view>
</template>

<script setup>
import { wishEnabled, privateChatEnabled, recruitmentEnabled } from '@/common/features.js'
import { communityEnabled } from "@/common/features.js"
import { selectCity } from '@/common/city-picker.js'
import { computed, getCurrentInstance, reactive, ref, watch } from 'vue'
import { onShow, onUnload, onPageScroll } from '@dcloudio/uni-app'
import {
  experience, ensureSession, refreshUnread, logoutFromServer, acceptAuthenticatedAccount,
  hasStaffAccess, onlineStaff, merchantStaff, threeTabStaff, currentStaffStore, staffStores, switchMode, resolveStaffEntry, refreshAccount as recheckAccount
} from '@/common/experience.js'
import { useScreen, go, relaunch, toast } from '@/common/screen.js'
import { get, post } from '@/common/request.js'
import {
  apiAccount, apiMeProfile, apiSaveMeProfile, apiMePoints, apiMeBlocks, apiMeUnblock,
  apiMeAuthorizations, apiMeWithdrawConsent, apiMeSessions, apiMeRevokeOthers, apiMeRevokeSession,
  apiMeRealName, apiMeDeactivation, apiMeDeactivate
} from '@/common/api.js'
import { apiDmPrivacy, apiSaveDmPrivacy } from '@/common/api.js'
import { sheet, errText, modal, askMonthDay } from '@/common/ui.js'
import { downloadDoc, absUrl } from '@/common/upload.js'
import { avatarPickerError, pickAvatarImage, uploadAvatar } from '@/common/upload-avatar.js'
import R from '@/common/routes.js'
// 会员等级图标：侧身袋鼠徽章 + 每级的低饱和配色，组件放在本分包里
import LevelIcon from './components/level-icon.vue'
import MediationEntry from './components/mediation-entry.vue'

// 之前：从权益详情「查看我的会员信息」打开 ?s=3 后，左上角返回落到「我的」，回不到权益页。
// 现在：从别的页面直接打开的那一屏返回原页面；页内点进去的屏、或本页就是栈底（登录后重启进来）时回到「我的」
let landing = 1
const s = useScreen(4, { onLoad: () => { landing = s.value } })
// 11-19 微信实拍返修（纯展示）：「我的」首屏往下滑过浅暖头部后，顶栏底色换成页面底色，不再在浅灰页面上顶着一条浅杏色带；只在越过 96 时改一次
const navSolid = ref(false)
onPageScroll((e) => { const v = (e && e.scrollTop) > 96; if (v !== navSolid.value) navSolid.value = v })
// 2026-10-17：从会员信息「完善个人资料 · 去完成」进的编辑资料，返回回到会员信息（editBackTo 见 doTask）
const onBack = () => {
  if (s.value === 2 && editBackTo) { s.value = editBackTo; editBackTo = 0; return }
  editBackTo = 0
  if (s.value === landing && getCurrentPages().length > 1) uni.navigateBack(); else s.value = 1
}
// s=2 是点哪改哪的编辑页，标题叫「编辑资料」（之前叫「个人资料」，和首屏只展示的资料卡分不清哪个能改）
const titles = ['我的', '编辑资料', '会员信息', '账号与隐私设置']

// ---------------------------------------------------------------------------
// 真实数据接入。
//
// 账号字段来自 /app/me/profile（昵称、性别、生日、常驻城市、自我介绍、手机号、实名状态、
// 积分与等级），登录态本身仍以 experience.account 为准；未登录直接回登录页，不展示空壳。
//
// 这一屏能改的每一项都直接落库：改完重新拉一次 profile，页面显示的就是服务端的值，
// 不在前端缓存一份"看起来已改"的状态。
// ---------------------------------------------------------------------------
const account = computed(() => experience.account || {})
const insuranceAccountVisible = ref(false)
let insuranceAccountRequest = 0
async function loadInsuranceAccountAccess() {
  const id = experience.account?.id, request = ++insuranceAccountRequest
  insuranceAccountVisible.value = false
  if (!id) return
  try {
    const res = await get('/app/insurance/account')
    if (pageActive && request === insuranceAccountRequest && experience.account?.id === id) insuranceAccountVisible.value = !!res.data?.hasPayments || Number(res.data?.balanceFen) > 0 || !!res.data?.entries?.length
  } catch { /* A failed account check never exposes another account's funds. */ }
}
watch(() => experience.account?.id, () => { insuranceAccountRequest++; insuranceAccountVisible.value=false })
const signedIn = computed(() => !!experience.account)
// 本页显示过已登录、之后账号被清掉（接口返回登录失效）时为 true，「我的」屏换成「去登录」卡；重新登录后自动收起
const loginLost = ref(false)
watch(signedIn, (now, before) => { loginLost.value = !now && !!before })
const teamReportsAllowed = ref(false)
let teamAccessRequest=0
async function loadTeamAccess(){const n=++teamAccessRequest,id=account.value.id;teamReportsAllowed.value=false;try{const r=await get('/app/team-reports/access');if(pageActive&&n===teamAccessRequest&&account.value.id===id)teamReportsAllowed.value=r.data?.allowed===true}catch{}}
watch(()=>account.value.id,()=>{teamAccessRequest++;teamReportsAllowed.value=false})
const me = ref(null)
const profileLoading = ref(true)
const profileError = ref('')
let profileRequest = 0, profileOwner = null
const staffEntering = ref(false)
let pageActive = true
onUnload(() => { pageActive = false })
// 员工身份下的「我的」：卡片改为身份选择入口，这是员工切回用户身份的唯一路径，不能再直接重进工作台
const staffMode = computed(() => experience.mode === 'staff' && hasStaffAccess.value)
// 只有合作商家身份的账号（V63）：「不进员工端」，切身份不经过员工入口页，直接回用户身份；进来时卡片也写商家工作台
const onlyMerchant = computed(() => staffStores.value.length > 0 && staffStores.value.every(g => g.roleCode === 'merchant'))
const staffRoleLine = computed(() => {
  const g = currentStaffStore.value || {}
  return [g.roleName, g.scopeKind === 'service-city' ? g.city : (g.storeName || g.city)].filter(Boolean).join(' · ') || '员工身份 · 内部门店业务'
})
const openStaff = async () => {
  if (staffEntering.value) return
  if (staffMode.value) return relaunch(switchMode('user'))
  staffEntering.value = true
  try {
    const route = await resolveStaffEntry({ isCurrent: () => pageActive })
    if (pageActive) relaunch(route)
  } catch (error) {
    if (pageActive) toast(error?.message || '员工权限读取失败，请重试')
  } finally {
    staffEntering.value = false
  }
}

const nickname = computed(() => (me.value ? me.value.nickname : account.value.nickname) || '')
// 头像为空时退回设计稿自带的占位图：这是页面资源而不是伪造的账号数据
const avatar = computed(() => absUrl((me.value && me.value.avatar) || account.value.avatar) || '/static/media/profile-avatar.jpg')
const avatarLarge = computed(() => absUrl((me.value && me.value.avatar) || account.value.avatar) || '/static/media/profile-avatar-lg.jpg')
// 会员编号沿用已有账号编号，不另造一套编号。
const memberNo = computed(() => (me.value ? me.value.memberNo : account.value.id) || '')
// 手机号由服务端脱敏后下发，未绑定时为空，不在前端拼接掩码
const phone = computed(() => (me.value ? me.value.phone : account.value.phone) || '')
const city = computed(() => (me.value ? me.value.city : account.value.city) || '')
const intro = computed(() => (me.value && me.value.intro) || '')
const realNameVerified = computed(() => !!(me.value && me.value.realNameVerified))
const realNameLabel = computed(() => (me.value ? me.value.realNameLabel : '未认证') || '未认证')

// 后端会给新用户返回真实的初始等级与 0 积分，不能把“没有流水”当成“没有会员信息”。
const membershipReady = computed(() => !!me.value?.levelName && me.value.points != null && Number.isFinite(Number(me.value.points)))
const levelName = computed(() => (me.value && me.value.levelName) || '')
const points = computed(() => (me.value ? me.value.points : '') || 0)
const pointsProgress = computed(() => String((me.value && me.value.pointsProgress) || ''))
// 服务端的 pointsProgress：没到最高等级是「累计获得 / 下一级门槛」（160/300），到了是「123456 积分」。
// 会员卡与会员详情共用服务端给出的进度。
const pointsPercent = computed(() => Math.max(0, Math.min(100, Number(me.value?.pointsPercent) || 0)))
// 服务端原话是「再获得 N 积分升到「小袋鼠」」；10-16 改版（设计图 22）去掉书名号，只在前端处理，会员权益页等别处不受影响
const upgradeTip = computed(() => String((me.value && me.value.upgradeTip) || '').replace(/「([^」]*)」/g, '$1'))
// 积分能花以后：上面的大数字是「可用积分」，等级按「累计获得」算（用掉不降级）。
// 2026-10-17：没用过积分时累计获得就等于当前积分，这行不显示；用过才写，免得「当前积分 50」和进度「350/800」对不上看不懂
const pointsLedgerText = computed(() => {
  const earned = Number(me.value?.earned), spent = Number(me.value?.spent) || 0
  if (!Number.isFinite(earned) || spent <= 0) return ''
  return `累计获得 ${earned} 分 · 已用掉 ${spent} 分（等级按累计获得算，用掉积分不降级）`
})
const records = ref([])
const recordTotal = ref(0)
const recordPage = ref(1)
const recordsLoading = ref(false)
const copyMemberNo = () => { if (memberNo.value) uni.setClipboardData({ data: String(memberNo.value) }) }

const load = async () => {
  const request = ++profileRequest, id = account.value.id
  profileLoading.value = true; profileError.value = ''
  if (profileOwner !== id) { me.value = null; profileOwner = id }
  try {
    const res = await apiMeProfile()
    if (!pageActive || request !== profileRequest || id !== account.value.id) return
    me.value = res.data || null
    records.value = res.data?.records || []
    recordTotal.value = res.data?.recordTotal || 0
    recordPage.value = 1
  } catch (e) {
    if (pageActive && request === profileRequest && id === account.value.id) profileError.value = '会员信息读取失败，请重新加载'
    throw e
  } finally {
    if (request === profileRequest) profileLoading.value = false
  }
}
const retryProfile = async () => {
  if (profileLoading.value) return
  try { await load() } catch (e) { toast(errText(e, '资料加载失败')) }
}

// 入口按用户要办的事情分组，复用原有页面和权限检查。
// art 对应确认稿中的业务插画，CELL_LINE 为通用图标名。
const CELL_LINE = { '我的行程': 'luggage', '我的评价': 'message-square-text', '我的收入': 'wallet', '简历与机会': 'id-card', '进入袋鼠群聊': 'messages-square', '大众评审': 'scale', '创办活动': 'party-popper', '我的发布': 'square-pen', '我的心愿': 'sparkles', '历史心愿订单': 'sparkles', '收藏与关注': 'bookmark', '全国攻略': 'book-open', '邀请有礼': 'gift', 'AI袋鼠': 'bot-message-square', '成为商家': 'store', '设置': 'settings' }
const aiOpen = ref(false)
const openAi = () => { aiOpen.value = true }
const withArt = (list) => list.filter(item => (!item.community || communityEnabled.value) && (recruitmentEnabled.value || ![R.resume,R.merchant].includes(item.url)))
const groups = computed(() => [
  { title: '订单与行程', items: withArt([
    { art: 'mine-trip', label: '我的行程', url: R.orders + '?cat=stay' },
    { art: 'mine-review', label: '我的评价', url: R.orders + '?s=2' },
    { art: 'mine-income', label: '我的收入', url: R.myIncome }
  ]) },
  { title: '工作与成长', items: withArt([
    { art: 'mine-resume', label: '简历与机会', url: R.resume },
    { community: true, art: 'mine-create', label: '创办活动', url: R.activityMine + '?view=create' },
    { label: '进入袋鼠群聊', art: 'nav-messages', url: '/pages/camp/index' },
    { label: '大众评审', url: '/pages/governance/jury' }
  ]) },
  { title: '内容与关注', items: withArt([
    { community: true, art: 'nav-publish', label: '我的发布', action: openMyPosts },
    { art: 'wish-mine', label: wishEnabled.value ? '我的心愿' : '历史心愿订单', url: R.wishMine },
    { art: 'mine-save', label: '收藏与关注', url: R.myFollows + '?mode=fav' },
    { community: true, art: 'mine-guide', label: '全国攻略', url: R.community + '?tab=guide&all=1' }
  ]) },
  { title: '更多服务', items: withArt([
    { art: 'mine-invite', label: '邀请有礼', url: R.invite },
    { art: 'mine-ai', label: 'AI袋鼠', action: openAi },
    { art: 'mine-merchant', label: '成为商家', url: R.merchant },
    { art: 'mine-settings', label: '设置', action: () => { s.value = 4 } }
  ]) }
])
const open = (cellItem) => (cellItem.action ? cellItem.action() : go(cellItem.url))
// 会员卡点开会员信息；还在读取或读取失败时不跳（卡里有「重新加载」）
const openMember = () => { if (membershipReady.value) s.value = 3 }
const openMyPosts = () => go(R.myPosts)

// 个人资料屏：没填的项一律写「未填写」、浅色字（之前只有性别有服务端给的「未填写」，生日、常驻城市空着只剩箭头）。
// 资料还没读到（me 为空）时先空着，不闪一下「未填写」
const EMPTY = '未填写'
const fieldOf = (key, label, value) => ({ key, label, value: value || (me.value ? EMPTY : ''), empty: !value && !!me.value })
// 2026-11-03 主人：简化 —— 昵称不再是「点一行弹输入框」，搬到上面「账号资料」区的输入框里（和自我介绍一起一个「保存」）
const fields = computed(() => [
  // 服务端没填性别时 genderLabel 就是「未填写」，按空处理，和别的空项一个颜色
  fieldOf('gender', '性别', me.value && me.value.genderLabel !== EMPTY ? me.value.genderLabel : ''),
  fieldOf('birthday', '生日', me.value && me.value.birthdayLabel),
  fieldOf('city', '常驻城市', city.value)
])
const introShown = computed(() => intro.value || (me.value ? EMPTY : ''))
const phoneShown = computed(() => phone.value || (me.value ? '未绑定' : ''))

// ---------------------------------------------------------------------------
// 编辑动作。
//
// 性别 / 生日 / 常驻城市仍是「点一行选一下」（菜单 / 滚轮 / 城市选择器）；
// 2026-11-03 主人：简化 —— 昵称、自我介绍、实名认证改成页面里的输入框（原来各弹系统输入框），注销的多重确认保留不动。
// ---------------------------------------------------------------------------
const busy = ref(false)
// 「账号资料」区：昵称 + 自我介绍，页面里直接改，改了才能点「保存」；资料读回来时把输入框填成服务端的值
const draft = reactive({ nickname: '', intro: '' })
const editingIntro = ref(false)
let editSession = 0
watch(() => account.value.id, () => {
  editSession++
  profileRequest++
  me.value = null
  draft.nickname = ''
  draft.intro = ''
  busy.value = false
  records.value = []
  recordTotal.value = 0
  realOpen.value = false
  realForm.name = ''
  realForm.idNo = ''
  realBusy.value = false
  exitingMerchant.value = false
  dmRequest++
  dmLoaded = false
  dmValue.value = ''
}, { flush: 'sync' })
const canFinishEdit = revision => pageActive && editSession === revision
watch(me, (v,old) => { if (v) { for (const key of ['nickname','intro']) { if (!old || draft[key] === (old[key] || '')) draft[key]=v[key] || '' } } }, { flush: 'sync' })
const draftChanged = computed(() => !!me.value && (String(draft.nickname).trim() !== nickname.value || String(draft.intro).trim() !== intro.value))
const saveDraft = async (event) => {
  if (event?.detail?.value?.nickname !== undefined) draft.nickname=event.detail.value.nickname
  const nick = String(draft.nickname || '').trim(), text = String(draft.intro || '').trim()
  if (!nick || nick.length > 16) return toast('昵称为 1–16 个字')
  if (text.length > 60) return toast('自我介绍 60 字以内')
  const payload = {}
  if (nick !== nickname.value) payload.nickname = nick
  if (text !== intro.value) payload.intro = text
  if (!Object.keys(payload).length) return
  await save(payload)
}

const prompt = (title, value, placeholder) => new Promise((resolve) => {
  uni.showModal({
    title,
    editable: true,
    placeholderText: placeholder || '',
    content: value || '',
    success: (r) => resolve(r.confirm ? (r.content || '').trim() : null),
    fail: () => resolve(null)
  })
})

const confirm = (title, content, confirmText) => new Promise((resolve) => {
  uni.showModal({
    title,
    content,
    confirmText: confirmText || '确定',
    success: (r) => resolve(!!r.confirm),
    fail: () => resolve(false)
  })
})

// 系统菜单超过 6 项时小程序会静默失败（退出其他设备 / 黑名单 / 撤回授权都可能超），统一走 ui.js 的分页菜单
const choose = (items) => sheet(items)

const save = async (payload, okText) => {
  if (busy.value || !pageActive || !account.value.id) return false
  const revision = editSession
  const submittedDraft = { ...draft }
  busy.value = true
  try {
    const res = await apiSaveMeProfile(payload)
    if (!canFinishEdit(revision)) return false
    // 之前：选完头像 / 常驻城市回到本页时 onShow 会同时重新拉资料，那次拉取若先读到旧值、晚于保存返回，
    // 就把刚保存的头像或城市盖回旧值，看起来像没保存上。现在保存成功后作废还在路上的拉取，以保存接口返回的资料为准
    if (res.data) { profileRequest++; profileLoading.value = false }
    const latestDraft = { ...draft }
    me.value = res.data || me.value
    for (const key of ['nickname', 'intro']) {
      if (latestDraft[key] !== submittedDraft[key]) draft[key] = latestDraft[key]
    }
    // 昵称与头像同时存在于登录态里，改完要让顶部、消息页等处也跟着变
    if (payload.nickname !== undefined || payload.avatar !== undefined) await refreshAccount(revision)
    if (!canFinishEdit(revision)) return false
    toast(okText || '已保存')
    return true
  } catch (e) {
    if (canFinishEdit(revision)) toast((e && e.message) || '保存失败')
    return false
  } finally {
    if (canFinishEdit(revision)) busy.value = false
  }
}

// 登录态里也存着昵称与头像（顶部问候、消息页都读它），改完要重新拉一次账号
const refreshAccount = async revision => {
  try {
    const res = await apiAccount()
    // 保留当前身份：有员工授权的账号在用户身份下改昵称 / 头像，不能被顺带切回员工身份
    if (res.data && canFinishEdit(revision)) acceptAuthenticatedAccount(res.data, { preserveMode: true })
  } catch (e) {
    // 账号刷新失败不影响这一页已经拿到的资料
  }
}

// 头像先裁成正方形再上传（之前长方形照片直接用上，圆形头像里只露中间一截）：
// 微信里弹系统的方形裁切框（wx.cropImage，基础库 2.26.0 起）；基础库太低没有这个接口时照旧直接上传；在裁切框里点取消就不换头像。
// 网页版没有系统裁切，按图片中心自动截一个正方形（最大 640px）再上传
const AVATAR_MAX = 640
const squareCrop = (path) => new Promise((resolve) => {
  // #ifdef MP-WEIXIN
  if (typeof wx === 'undefined' || typeof wx.cropImage !== 'function') return resolve(path)
  wx.cropImage({
    src: path,
    cropScale: '1:1',
    success: (r) => resolve((r && r.tempFilePath) || path),
    fail: (e) => resolve(/cancel/i.test(String(e && e.errMsg)) ? null : path)
  })
  // #endif
  // #ifdef H5
  const img = new Image()
  img.onload = () => {
    try {
      const side = Math.min(img.naturalWidth, img.naturalHeight)
      if (!side) return resolve(path)
      const out = Math.min(side, AVATAR_MAX)
      const canvas = document.createElement('canvas')
      canvas.width = out
      canvas.height = out
      canvas.getContext('2d').drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, out, out)
      resolve(canvas.toDataURL('image/jpeg', 0.9))
    } catch (e) {
      resolve(path)
    }
  }
  img.onerror = () => resolve(path)
  img.src = path
  // #endif
  // #ifndef MP-WEIXIN || H5
  resolve(path)
  // #endif
})

async function persistAvatar(path) {
  if (!path || busy.value) return
  const revision=editSession
  busy.value=true
  try {
    const up=await uploadAvatar(path, () => canFinishEdit(revision))
    if (!canFinishEdit(revision)) return
    if (!up.data?.url) throw new Error('头像上传失败，请重试')
    busy.value=false
    await save({avatar:up.data.url},'头像已更新')
  } catch(e) {if(canFinishEdit(revision))toast(e?.message || '头像上传失败，请重试')}
  finally {if(canFinishEdit(revision))busy.value=false}
}
function onAvatarError(event) {
  const message = avatarPickerError(event)
  if (message) toast(message)
}
const chooseWechatAvatar = e => e?.detail?.avatarUrl ? persistAvatar(e.detail.avatarUrl) : onAvatarError(e)
const changeAvatar = async () => {
  if (busy.value) return
  const revision = editSession
  const current = () => canFinishEdit(revision)
  try {
    const picked = await pickAvatarImage()
    if (!picked || !current()) return
    const path = await squareCrop(picked)
    if (current()) await persistAvatar(path)
  } catch (error) {
    if (current()) toast(error.message || '无法选择头像，请重试')
  }
}

const editField = async (f) => {
  const revision = editSession
  if (f.key === 'gender') {
    const i = await choose(['男', '女', '不填写'])
    if (i < 0 || !canFinishEdit(revision)) return
    await save({ gender: i === 0 ? '1' : i === 1 ? '2' : '0' })
    return
  }
  if (f.key === 'birthday') {
    // 之前要按 MM-dd 手动输入（而且默认值没带进输入框），现在用月 / 日滚轮选
    const v = await askMonthDay('生日', { value: (me.value && me.value.birthday) || '', emptyText: '清空生日' })
    if (v === null || !canFinishEdit(revision)) return
    // 生日礼物只有换工主理人、城市负责人能领（生日当月、满足条件后在「荣誉与关怀」申领，条件服务端判）；其他人生日当天是门店任务积分双倍，之前对谁都提示当天能领礼物
    const manager = (account.value.staffGrants || []).some(g => g.active === true && ['manager', 'city_lead'].includes(g.roleCode))
    await save({ birthday: v }, !v ? '已清空生日' : (manager ? '生日已保存，满足条件的话生日当月可在「荣誉与关怀」申领礼物' : '生日已保存，生日当天门店任务积分双倍'))
    return
  }
  if (f.key === 'city') {
    const v = await selectCity({ title: '常驻城市', value: city.value })
    if (v === null || !canFinishEdit(revision)) return
    await save({ city: v })
  }
}

const moreRecords = async () => {
  if (recordsLoading.value) return
  if (records.value.length >= recordTotal.value) {
    toast(recordTotal.value ? '已经是全部记录了' : '还没有积分记录')
    return
  }
  const revision = profileRequest, id = account.value.id
  recordsLoading.value = true
  try {
    const res = await apiMePoints(recordPage.value + 1)
    if (!pageActive || revision !== profileRequest || id !== account.value.id) return
    const more = (res.data && res.data.records) || []
    records.value = records.value.concat(more)
    recordPage.value += 1
    if (records.value.length >= recordTotal.value) toast('已加载全部 ' + recordTotal.value + ' 条')
  } catch (e) {
    toast((e && e.message) || '加载失败')
  } finally {
    recordsLoading.value = false
  }
}

// ---------------------------------------------------------------------------
// 账号与隐私
// ---------------------------------------------------------------------------
// 谁可以私信我：进「账号与隐私设置」时读一次，选了马上保存；读不到时显示「所有人」（服务端默认值）
const DM_OPTIONS = [{ key: 'all', label: '所有人' }, { key: 'following', label: '我关注的人' }, { key: 'mutual', label: '互相关注的人' }]
const dmValue = ref('')
const dmLabel = computed(() => (DM_OPTIONS.find(x => x.key === dmValue.value) || { label: dmValue.value ? '' : '所有人' }).label)
let dmLoaded = false
let dmRequest = 0
async function loadDmPrivacy() {
  const revision = editSession, request = ++dmRequest
  try {
    const response = await apiDmPrivacy()
    if (!canFinishEdit(revision) || request !== dmRequest) return
    dmValue.value = response.data?.value || 'all'
    dmLoaded = true
  } catch { /* 下次打开时重试 */ }
}
async function pickDmPrivacy() {
  const revision = editSession
  if (!dmLoaded) await loadDmPrivacy()
  if (!canFinishEdit(revision)) return
  const i = await sheet(DM_OPTIONS.map(x => x.label + (x.key === dmValue.value ? '（当前）' : '')))
  if (!canFinishEdit(revision) || !DM_OPTIONS[i] || DM_OPTIONS[i].key === dmValue.value) return
  try {
    const res = await apiSaveDmPrivacy(DM_OPTIONS[i].key)
    if (!canFinishEdit(revision)) return
    dmValue.value = res.data?.value || DM_OPTIONS[i].key
    dmLoaded = true
    toast(res.data?.message || '已保存')
  } catch (e) {
    if (canFinishEdit(revision)) toast(errText(e, '保存失败，请重试'))
  }
}
watch([s, () => account.value.id], ([screen, id]) => {
  if (screen === 4 && id && !dmLoaded) loadDmPrivacy()
}, { immediate: true })

const openBlocks = async () => {
  const revision = editSession
  try {
    const res = await apiMeBlocks()
    if (!canFinishEdit(revision)) return
    const rows = (res.data && res.data.rows) || []
    if (!rows.length) {
      toast('黑名单是空的')
      return
    }
    const i = await choose(rows.map(r => r.name + '（' + r.time + '）'))
    if (!canFinishEdit(revision)) return
    if (i < 0) return
    if (!await confirm('移出黑名单', '把「' + rows[i].name + '」移出黑名单？之后你们可以互相看到对方的内容。')) return
    if (!canFinishEdit(revision)) return
    const out = await apiMeUnblock(rows[i].userId)
    if (!canFinishEdit(revision)) return
    toast((out.data && out.data.message) || '已移出')
  } catch (e) {
    if (!canFinishEdit(revision)) return
    toast((e && e.message) || '加载失败')
  }
}

const openAuthorizations = async () => {
  const revision = editSession
  try {
    const res = await apiMeAuthorizations()
    if (!canFinishEdit(revision)) return
    const d = res.data || {}
    const consents = d.consents || []
    const stores = d.resumeStores || []
    const lines = []
    lines.push(stores.length ? '简历可见门店：' + stores.join('、') : '还没有门店能看到你的简历')
    lines.push(consents.length ? '已同意：' + consents.map(c => c.title).join('、') : '还没有同意记录')
    lines.push(d.note || '')
    // 《用户协议》《隐私政策》是使用小程序的前提，服务端不让单独撤回（不想再用可以注销账号）：「已同意」照常列出，撤回选项里不放这两份，
    // 免得点了必定失败。同一份文件同意过多个版本时撤回会一并撤掉，选项里只列一次（列表按同意时间倒序，留最近那次）
    const LEGAL = ['terms', 'privacy']
    const revocable = consents.filter((c, k) => !LEGAL.includes(c.doc) && consents.findIndex(x => x.doc === c.doc) === k)
    if (consents.some(c => LEGAL.includes(c.doc))) lines.push('《用户协议》《隐私政策》不能单独撤回，不再使用可以注销账号。')
    if (!revocable.length) {
      await confirm('授权管理', lines.join('\n'), '知道了')
      if (!canFinishEdit(revision)) return
      return
    }
    if (!await confirm('授权管理', lines.join('\n') + '\n\n要撤回某条同意吗？', '去撤回')) return
    if (!canFinishEdit(revision)) return
    const i = await choose(revocable.map(c => c.title + '（' + c.time + '）'))
    if (!canFinishEdit(revision)) return
    if (i < 0) return
    if (!await confirm('撤回同意', '撤回后，再次使用相关功能时会重新征求你的同意。')) return
    if (!canFinishEdit(revision)) return
    const out = await apiMeWithdrawConsent(revocable[i].doc)
    if (!canFinishEdit(revision)) return
    toast((out.data && out.data.message) || '已撤回')
  } catch (e) {
    if (!canFinishEdit(revision)) return
    toast((e && e.message) || '加载失败')
  }
}

const exportData = async () => {
  const revision = editSession
  if (!await confirm('导出数据', '会生成一份包含账号、简历、订单、评价、积分、钱包流水与授权记录的表格；手机号在导出件里仍为脱敏显示。', '开始导出')) return
  if (!canFinishEdit(revision)) return
  try {
    toast('正在生成…')
    await downloadDoc('/app/me/export.xlsx', 'xlsx', '袋鼠全球青年-我的数据.xlsx')
    if (!canFinishEdit(revision)) return
  } catch (e) {
    if (!canFinishEdit(revision)) return
    toast((e && e.message) || '导出失败')
  }
}

// 退出合作商家（POST /app/merchant/exit，不进主包 api.js）：没有上架岗位、进行中的报名和需求才能退，服务端说还差什么就照实显示
const apiMerchantExit = () => post('/app/merchant/exit')
const exitingMerchant = ref(false)
const exitMerchant = async () => {
  if (exitingMerchant.value) return
  const revision = editSession, store = currentStaffStore.value
  const name = store?.storeName || '这家店'
  exitingMerchant.value = true
  try {
    const accepted = await confirm('退出合作商家', '退出后不能再发布招募和线上任务；「' + name + '」如果是你自己提交「成为商家」开通的，会一并停用。想重新合作要再提交申请，等袋鼠全球青年联系你。', '确认退出')
    if (!accepted || !canFinishEdit(revision) || currentStaffStore.value?.storeId !== store?.storeId) return
    const out = await apiMerchantExit()
    if (!canFinishEdit(revision)) return
    await recheckAccount()
    if (!canFinishEdit(revision)) return
    toast(out.msg)
    relaunch(switchMode(hasStaffAccess.value ? 'staff' : 'user'))
  } catch (e) {
    if (canFinishEdit(revision)) await confirm('暂时不能退出', errText(e, '退出失败，请重试'), '知道了')
  } finally {
    if (canFinishEdit(revision)) exitingMerchant.value = false
  }
}

const deactivate = async () => {
  const revision = editSession
  try {
    const res = await apiMeDeactivation()
    if (!canFinishEdit(revision)) return
    const d = res.data || {}
    if (!d.canDeactivate) {
      await confirm('暂时不能注销', (d.blockers || []).join('\n'), '知道了')
      if (!canFinishEdit(revision)) return
      return
    }
    const text = '注销后会清除：\n' + (d.willDelete || []).join('\n')
      + '\n\n依法保留：\n' + (d.willKeep || []).join('\n')
    if (!await confirm('注销账号', text, '继续注销')) return
    if (!canFinishEdit(revision)) return
    const reason = await prompt('注销原因（选填）', '', '说一句原因，帮我们改进')
    if (!canFinishEdit(revision)) return
    if (reason === null) return
    const word = await prompt('最后确认', '', '输入「' + (d.confirmWord || '确认注销') + '」以确认')
    if (!canFinishEdit(revision)) return
    if (word === null) return
    const out = await apiMeDeactivate(word, reason)
    if (!canFinishEdit(revision)) return
    await confirm('已注销', (out.data && out.data.message) || '账号已注销', '好')
    if (!canFinishEdit(revision)) return
    await logoutFromServer()
    if (pageActive && !experience.account) relaunch(R.login)
  } catch (e) {
    if (!canFinishEdit(revision)) return
    toast((e && e.message) || '操作失败')
  }
}

// ---------------------------------------------------------------------------
// 账号与安全
// ---------------------------------------------------------------------------
const bindPhone = () => go(R.login + '?s=4&mode=bind-phone')

const openSessions = async () => {
  const revision = editSession
  try {
    const res = await apiMeSessions()
    if (!canFinishEdit(revision)) return
    const rows = (res.data && res.data.rows) || []
    if (!rows.length) {
      toast('暂时读不到登录设备')
      return
    }
    const fmt = (t) => {
      if (!t) return ''
      const d = new Date(t)
      const pad = (n) => (n < 10 ? '0' + n : '' + n)
      return pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes())
    }
    const items = rows.map(r => r.device + (r.current ? '（当前）' : '') + ' · ' + fmt(r.activeTime) + (r.ip ? ' · ' + r.ip : ''))
    const others = rows.filter(r => !r.current).length
    if (others) items.push('退出其他 ' + others + ' 台设备')
    const i = await choose(items)
    if (!canFinishEdit(revision)) return
    if (i < 0) return
    if (others && i === items.length - 1) {
      if (!await confirm('退出其他设备', '其他设备需要重新登录，当前这台不受影响。')) return
      if (!canFinishEdit(revision)) return
      const out = await apiMeRevokeOthers()
      if (!canFinishEdit(revision)) return
      toast((out.data && out.data.message) || '已退出')
      return
    }
    const row = rows[i]
    if (row.current) {
      toast('这是当前设备，可用下方「退出登录」')
      return
    }
    if (!await confirm('退出该设备', row.device + ' 需要重新登录。')) return
    if (!canFinishEdit(revision)) return
    const out = await apiMeRevokeSession(row.id)
    if (!canFinishEdit(revision)) return
    toast((out.data && out.data.message) || '已退出')
  } catch (e) {
    if (!canFinishEdit(revision)) return
    toast((e && e.message) || '加载失败')
  }
}

// 2026-11-03 主人：简化 —— 实名认证是编辑资料屏里的折叠区（两个输入框 + 一个按钮），原来姓名、身份证号各弹一个系统输入框、已认证 / 没开通也各弹一个提示
const realOpen = ref(false)
const realForm = reactive({ name: '', idNo: '' })
const realBusy = ref(false)
const toggleReal = () => { realOpen.value = !realOpen.value }
const submitRealName = async () => {
  const revision = editSession
  if (realBusy.value) return
  const name = String(realForm.name || '').trim(), idNo = String(realForm.idNo || '').trim().toUpperCase()
  if (!name) return toast('请填写身份证上的姓名')
  if (!/^\d{17}[\dX]$/.test(idNo)) return toast('请填写 18 位身份证号')
  realBusy.value = true
  try {
    const out = await apiMeRealName(name, idNo)
    if (!canFinishEdit(revision)) return
    await load()
    if (!canFinishEdit(revision)) return
    realForm.name = ''; realForm.idNo = ''
    toast((out.data && out.data.message) || '认证已通过')
  } catch (e) {
    if (!canFinishEdit(revision)) return
    toast((e && e.message) || '认证失败')
  } finally {
    if (canFinishEdit(revision)) realBusy.value = false
  }
}
// 设置屏「账号与安全 · 实名认证」那一行：转到编辑资料屏并展开折叠区，返回回到设置屏
const realName = () => {
  realOpen.value = true
  if (s.value !== 2) { editBackTo = s.value; s.value = 2 }
}

const loginWay = async () => {
  await confirm('登录方式', '本小程序使用微信登录，没有独立密码，因此不需要（也无法）修改密码。'
    + '\n换手机后用同一个微信登录即可；怀疑账号异常时，可在「设备与登录」里退出其他设备。', '知道了')
}

const security = computed(() => [
  { key: 'phone', icon: 'smartphone', label: '手机号', value: phone.value || '未绑定' },
  // 微信登录没有密码，这一行如实写成「登录方式」，不再提示"定期修改密码"
  { key: 'login', icon: 'lock', label: '登录方式', value: '微信登录' },
  { key: 'devices', icon: 'monitor', label: '设备与登录', value: '管理登录设备与记录' },
  { key: 'realname', icon: 'shield-check', label: '实名认证', value: realNameLabel.value, green: realNameVerified.value }
])

const openSecurity = (r) => {
  if (r.key === 'phone') return bindPhone()
  if (r.key === 'login') return loginWay()
  if (r.key === 'devices') return openSessions()
  return realName()
}

// 服务端登出：先撤销令牌再清本地会话，失败也会清干净，最后回到登录页
const signOut = async () => {
  await logoutFromServer()
  relaunch(R.login)
}

onShow(async () => {
  // 冷启动时登录态还在恢复，先等恢复完再拉数据，否则会被当成未登录
  await ensureSession()
  if (!experience.account) {
    relaunch(R.login + '?entry=profile')
    return
  }
  // 会话中途店里 / 后台新授予或撤销了员工授权：静默重读一次账号（不改当前身份），「员工工作台」卡片马上跟着变，不用等下次冷启动
  void loadTeamAccess()
  void loadInsuranceAccountAccess()
  const recheck = recheckAccount().catch(() => {})
  try {
    await load()
  } catch (e) {
    // 登录中途失效：页面已换成「去登录」卡，不再另弹一句「未登录或登录已失效」
    if (experience.account) toast((e && e.message) || '资料加载失败')
  }
  // 账号重读会清空消息缓存：等它落地再拉未读数，红点不会被清掉。
  // 这里只要底栏「消息」红点的数字，只拉未读数；之前拉整份消息列表，员工身份要下载约 258KB
  await recheck
  try {
    await refreshUnread()
  } catch (e) {
    // 未读数拉不到就沿用 0，不因为一个角标打断整页展示
  }
})

// 六级阶梯本身是等级体系的介绍（静态内容）；"当前停在哪一级"来自服务端的 level（0..5）。
// 等级图标统一用 components/level-icon.vue（侧身袋鼠徽章 + 每级的低饱和配色），这里只给等级序号；名字以后台设置为准。
const levelNames = ['幼崽鼠', '小袋鼠', '袋鼠', '大袋鼠', '巨袋鼠', '袋鼠王']
const levelLabels = computed(() => me.value?.levels?.map(level => level.levelName) || levelNames)
// 每级所需积分（后台「会员等级」的 minPoints）；老接口没带 levels 时用上线时的默认门槛
const levelMins = computed(() => me.value?.levels?.map(level => Number(level.minPoints) || 0) || [0, 15, 40, 90, 200, 400])
const currentLevel = computed(() => (membershipReady.value ? Number(me.value.level) : -1))
const levelNodes = computed(() => levelLabels.value.map((label, i) => ({
  label, level: i, min: levelMins.value[i] ?? 0, cur: i === currentLevel.value, off: !(i <= currentLevel.value)
})))

// ---------------------------------------------------------------------------
// 会员信息屏（2026-10-17 主人样稿）
// ---------------------------------------------------------------------------
// 顶部大头像：用户上传过头像就用头像（右下角挂等级小图标），没有时直接放当前等级图标（不再用 profile-avatar 占位照片）
const hasAvatar = computed(() => !!((me.value && me.value.avatar) || account.value.avatar))
const heroAvatar = computed(() => (hasAvatar.value ? avatar.value : ''))
// 升级进度：「160/300」（累计获得 / 下一级门槛），最高等级不显示；提示语服务端原话「再获得 N 积分升到「X」」，这里写成「升级到X」
const progressCount = computed(() => (pointsProgress.value.includes('/') ? pointsProgress.value : ''))
const upgradeLine = computed(() => upgradeTip.value.replace('升到', '升级到'))
// 等级沿用后台配置；可查看六级全部权益，完整保留条目与使用条件。
const selectedPerkLevel = ref(null)
watch(currentLevel, value => { selectedPerkLevel.value = value }, { immediate: true })
const allPerks = computed(() => {
  const list = Array.isArray(me.value?.levelPerks) && me.value.levelPerks.length ? me.value.levelPerks
    : (me.value?.levels || []).map(level => ({ ...level, items: [], shopCount: 0 }))
  return list.map(perkItem => {
    const level = Number(perkItem.level) || 0
    return { level, levelName: perkItem.levelName, minPoints: Number(perkItem.minPoints) || levelMins.value[level] || 0,
      cur: level === currentLevel.value, off: level > currentLevel.value, shops: Number(perkItem.shopCount) || 0,
      lines: Array.isArray(perkItem.items) ? perkItem.items : [] }
  })
})
const selectedPerk = computed(() => allPerks.value.find(item => item.level === selectedPerkLevel.value) || allPerks.value.find(item => item.cur) || allPerks.value[0])
const selectPerk = level => { selectedPerkLevel.value = level }
// 赚取积分：服务端 tasks（完善个人资料 / 首次入住评价 / 旅居攻略 / 邀请好友 / 换工换宿，停发的不下发），两项一张卡
const TASK_ICONS = { profile: 'user-round-check', stay_review: 'star', guide: 'house', invite: 'user-plus', volunteer: 'heart-handshake' }
const earnTasks = computed(() => (Array.isArray(me.value?.tasks) ? me.value.tasks : []).filter(taskItem => (communityEnabled.value || taskItem.action !== 'guide') && (recruitmentEnabled.value || !['volunteer','resume','apply'].includes(taskItem.action))).map(taskItem => ({ ...taskItem, icon: TASK_ICONS[taskItem.key] || 'sparkles' })))
const taskGroups = computed(() => earnTasks.value.reduce((out, taskItem, i) => { if (i % 2 === 0) out.push([]); out[out.length - 1].push(taskItem); return out }, []))
// 「去完成」：编辑资料（本页第 2 屏，返回时回到会员信息）、我的评价（待评价）、发布页（2026-10-17：预选旅居攻略，kind=daily）、邀请有礼、换工岗位列表
let editBackTo = 0
const doTask = (taskItem) => {
  if (taskItem.action === 'profile') { editBackTo = 3; s.value = 2 }
  else if (taskItem.action === 'review') go(R.orders + '?s=2')
  else if (taskItem.action === 'guide') go(R.publish + '?kind=daily')
  else if (taskItem.action === 'invite') go(R.invite)
  else if (taskItem.action === 'volunteer') go(R.jobsList + '?type=volunteer')
}
// 积分规则：服务端 ruleRows（标题 + 一句话），老接口只有 note 时按行拆
const ruleRows = computed(() => {
  const rows = Array.isArray(me.value?.ruleRows) && me.value.ruleRows.length ? me.value.ruleRows
    : String(me.value?.note || '').split('\n').filter(Boolean).map(text => ({ title: '', text }))
  return rows.map((ruleItem, i) => ({ ...ruleItem, no: (i < 9 ? '0' : '') + (i + 1) }))
})
// 「积分规则」「查看等级」：滚到对应卡片，停在吸顶的顶栏下面（量卡片和本屏开头的距离，和城市页跳字母同一个办法）
const profilePage = getCurrentInstance()
const jumpTo = (selector) => {
  uni.createSelectorQuery().in(profilePage && profilePage.proxy).select('.mi').boundingClientRect().select(selector).boundingClientRect().exec((res) => {
    const [body, target] = res || []
    if (body && target) uni.pageScrollTo({ scrollTop: Math.max(0, Math.round(target.top - body.top)), duration: 250 })
    else uni.pageScrollTo({ selector, duration: 250 })
  })
}
// 连线上赭色那一段画到当前等级为止（占整条线的百分比）
const levelReach = computed(() => {
  const last = levelLabels.value.length - 1
  return last > 0 ? Math.max(0, Math.min(100, (currentLevel.value / last) * 100)) || 0 : 0
})
</script>

<style scoped lang="scss">
.member-actions { display:flex; flex-direction:column; gap:2px; flex-shrink:0; }
.member-actions .member-cta { min-height:44px; gap:4px; justify-content:flex-end; }
@import '../../styles/look.scss';
.b { display: block; }
.k-mt2 { margin-top: 2px; }
.k-mt6 { margin-top: 6px; }
.k-mt10 { margin-top: 10px; }
/* 卡片不画框线：纯白底、16px 圆角加一层柔和阴影（10-16 全站配色：奶白页面底 + 纯白卡片） */
.card { background: var(--k-paper); border-radius: var(--k-radius, 16px); padding: 14px; box-shadow: var(--k-sh1); }
.card--tight { padding: 0 14px; }
.card--group { padding: 12px 14px 0; }
/* 进度条：暖棕（和会员卡同色） */
.bar { height: 6px; border-radius: 3px; background: #F0E5D6; overflow: hidden; }
.bar__fill { height: 100%; border-radius: 3px; background: linear-gradient(90deg, #C79A69, var(--k-red)); }

/* 我的：清晰的资料卡、会员卡与四列功能分组。 */
.mine { padding-top: 12px; }
.mine .card { border-radius: 16px; }
.relogin { display: flex; flex-direction: column; gap: 4px; padding: 18px 16px; }
.relogin__title { font-size: 18px; font-weight: 700; line-height: 1.4; color: var(--k-ink); }
.relogin__hint { font-size: 14px; line-height: 1.6; color: var(--k-muted); }
.me { display: flex; align-items: center; gap: 12px; padding: 16px 14px; }
.me__avatar { width: 58px; height: 58px; border-radius: 50%; border: 2px solid var(--k-paper); box-shadow: 0 0 0 1px var(--k-line); flex: 0 0 auto; }
.me__info { min-width: 0; gap: 2px; }
.me__name { font-size: 22px; font-weight: 700; line-height: 1.4; color: var(--k-ink); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.me__no { display: flex; align-items: center; gap: 4px; align-self: flex-start; max-width: 100%; min-height: 44px; margin: -6px 0; font-size: 12px; color: var(--k-muted); }
.me__no text { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.me__edit { flex: 0 0 auto; display: flex; align-items: center; min-height: 44px; }
.me__edit-pill { display: flex; align-items: center; height: 32px; padding: 0 12px; border: 1px solid var(--k-red); border-radius: 999px; color: var(--k-red-deep, #8A5E36); font-size: 13px; font-weight: 600; white-space: nowrap; }
.level__name { color: #5E3D1F; }
.member-card { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 12px; margin-top: 14px; padding: 16px; overflow: hidden; background: linear-gradient(118deg, #FBF1E4 0%, #F5E2CB 55%, #EDD1B2 100%); box-shadow: 0 6px 16px rgba(154,107,63,.12); }
.member-mascot { flex: 0 0 72px; width: 72px; height: 76px; display: flex; align-items: center; justify-content: center; }
.member-body { flex: 1; min-width: 0; }
.member-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.member-level { min-width: 0; font-size: 23px; font-weight: 700; line-height: 1.35; overflow-wrap: anywhere; }
.member-points { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px; margin-top: 3px; color: #74502F; }
.member-points__num { font-size: 22px; font-weight: 700; line-height: 1.4; overflow-wrap: anywhere; }
.member-points__unit { font-size: 13px; white-space: nowrap; }
.member-cta { flex: 0 0 auto; min-height: 44px; display: flex; align-items: center; }
.member-cta__pill { display: flex; align-items: center; height: 30px; padding: 0 10px; border: 1px solid rgba(154,107,63,.65); border-radius: 999px; background: rgba(255,255,255,.4); color: #74502F; font-size: 13px; font-weight: 600; white-space: nowrap; }
.member-growth { flex: 0 0 100%; min-width: 0; }
.member-bar { width: 100%; height: 5px; border-radius: 3px; background: rgba(154,107,63,.2); overflow: hidden; }
.member-bar .bar__fill { height: 100%; border-radius: 3px; }
.member-card .member-progress { display: flex; flex-wrap: nowrap; align-items: flex-start; justify-content: space-between; gap: 8px; margin-top: 10px; }
.member-card .member-note { font-size: 12px; line-height: 1.6; color: #74502F; }
.member-tip { flex: 1; min-width: 0; }
.member-count { flex: 0 0 auto; color: #74502F; font-size: 12px; line-height: 1.6; }
.member-card .member-state { min-height: 90px; justify-content: center; }
@media (max-width: 359px) {
  .me { gap: 8px; padding: 14px 10px; }
  .me__avatar { width: 48px; height: 48px; }
  .me__name { font-size: 19px; }
  .me__no { font-size: 11px; gap: 2px; }
  .me__edit-pill { padding: 0 8px; font-size: 12px; }
  .member-card { padding: 14px 12px; gap: 10px; }
  .member-level { font-size: 20px; }
  .member-cta__pill { padding: 0 8px; font-size: 12px; }
}
.member-link { display: flex; align-items: center; justify-content: center; gap: 4px; min-height: 44px; margin: 0; padding: 0 2px 0 10px; background: transparent; color: var(--k-muted); font-size: 14px; line-height: 1.5; border: 0; border-radius: 0; }
.member-link::after { border: 0; }
.member-link[disabled] { color: var(--k-muted); background: transparent; opacity: .45; }
.member-note { font-size: 14px; line-height: 1.6; color: var(--k-muted); overflow-wrap: anywhere; }
.member-state { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; font-size: 14px; line-height: 1.6; color: var(--k-muted); }
.member-state .member-link { padding-left: 0; color: var(--k-red); }
.member-progress { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 4px 12px; }
/* 分组的顺序与每项路由分别对应订单、工作和内容。 */
.grid-card { margin-top: 14px; padding: 14px 6px 10px; }
.grid-card__title { display: block; padding: 0 10px; font-size: 18px; font-weight: 700; line-height: 1.4; color: var(--k-ink); }
.grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); margin-top: 12px; }
.grid--3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.cell { display: flex; flex-direction: column; align-items: center; gap: 8px; min-width: 0; padding: 4px 0 8px; }
.cell__icon { position: relative; width: 38px; height: 38px; }
.cell__img { width: 38px; height: 38px; }
.cell__badge { position: absolute; top: -5px; left: 26px; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px; background: var(--k-alert, #C04437); color: var(--k-paper); font-size: 11px; line-height: 18px; text-align: center; white-space: nowrap; }
.cell__label { max-width: 100%; font-size: 14px; line-height: 1.5; color: var(--k-ink); white-space: nowrap; }
.extra-links { display: flex; justify-content: center; gap: 28px; margin-top: 12px; }
.extra-link { display: flex; align-items: center; gap: 4px; min-height: 44px; color: var(--k-ink2); font-size: 13px; }
.staff { display: flex; align-items: center; gap: 10px; min-height: 60px; margin-top: 10px; padding: 12px 14px; }
.staff__icon { width: 32px; height: 32px; flex: 0 0 auto; }
.staff__title { flex: 1 0 auto; font-size: 16px; font-weight: 600; white-space: nowrap; }
.staff__state { flex: 0 1 auto; min-width: 0; font-size: 13px; color: var(--k-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
@media (max-width: 359px) {
  .grid-card { padding-left: 4px; padding-right: 4px; }
  .cell__label { font-size: 12px; }
  .staff { gap: 8px; }
  .staff__title { font-size: 15px; }
  .staff__state { font-size: 12px; }
}

/* s2 */
.avatar-box { display: flex; flex-direction: column; align-items: center; padding: 20px 0 18px; border-bottom: 1px solid var(--k-line); }
.avatar-box__img { width: 80px; height: 80px; border-radius: 50%; }
.frow { position: relative; display: flex; align-items: center; gap: 8px; min-height: 49px; }
.frow::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); transform-origin: 0 100%; }
.frow:last-child::after { display: none; }
/* 编辑资料屏底部的简历入口：浅色一行文字链接，不再是整宽大按钮 */
.resume-link { display: flex; align-items: center; justify-content: center; gap: 2px; min-height: 44px; margin-top: 12px; color: var(--k-ink2); font-size: 13px; }
.frow__label { flex: 1; font-size: 16px; color: var(--k-ink); }
.frow__value { font-size: 16px; color: var(--k-ink); }
/* 没填的项：「未填写」「未绑定」用浅色字（白卡上 16px，对比度够） */
.frow__value--empty { color: var(--k-muted); }
.frow--intro { align-items: center; padding: 12px 0 10px; }
.frow--intro .frow__label { flex: 0 0 auto; }
.frow__intro { margin-top: 6px; font-size: 15px; line-height: 1.7; }
.frow__side { display: flex; flex-direction: column; align-items: flex-end; gap: 12px; align-self: stretch; justify-content: space-between; padding-top: 22px; }
.ok { width: 16px; height: 16px; }
/* 2026-11-03 主人：简化 —— 「账号资料」区（昵称 / 自我介绍输入框 + 保存钮）和实名认证折叠区 */
.acct { position: relative; padding: 14px 0 12px; display: flex; flex-direction: column; gap: 10px; }
.acct::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); transform-origin: 0 100%; }
.acct__title { font-family: var(--k-display-font); font-weight: 700; font-size: 16px; }
.acct__row { display: flex; align-items: center; gap: 10px; }
.acct__row--top { align-items: flex-start; }
.acct__label { flex: 0 0 72px; font-size: 15px; color: var(--k-ink); line-height: 44px; }
.acct__input { flex: 1; min-width: 0; }
.acct__area { flex-direction: column; align-items: stretch; padding: 10px 12px; }
.acct__textarea, .acct__idle { width: 100%; min-height: 66px; font-size: 14px; line-height: 1.6; }
.acct__idle { white-space: pre-wrap; word-break: break-all; }
.acct__count { align-self: flex-end; margin-top: 4px; font-size: 12px; color: var(--k-muted); }
.acct__save { margin-top: 2px; }
.real { padding: 4px 0 12px; display: flex; flex-direction: column; gap: 10px; }
.real__hint { font-size: 13px; line-height: 1.7; color: var(--k-muted); }

/* s3 会员信息（2026-10-17 主人样稿）：暖色大卡 + 白卡分区；分区标题 17px 粗黑，卡片间距 12px */
.mi-sec { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 44px; margin-top: 10px; padding: 0 2px; }
.mi-title { font-size: 17px; font-weight: 700; line-height: 1.4; color: var(--k-ink); }
.mi-card { margin-top: 12px; }
.mi-sec + .mi-card, .mi-sec + .mi-perks, .mi-sec + .mi-tasks { margin-top: 2px; }
.mi-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: -10px 0 0; min-height: 44px; }
.mi-link { display: flex; align-items: center; gap: 2px; min-height: 44px; margin-right: -4px; padding: 0 4px 0 10px; font-size: 13px; color: var(--k-muted); white-space: nowrap; }
/* 顶部暖卡：和「我的」会员卡同一套奶茶色渐变；左边 76px 圆头像（白边 + 暖线），右边等级名（衬线粗体暖棕）+「普通会员」小胶囊、昵称、当前积分 +「积分规则」描边胶囊 */
.mi-hero { position: relative; display: flex; align-items: center; gap: 14px; padding: 18px 14px 16px 16px; overflow: hidden;
  background: linear-gradient(118deg, #FBF1E4 0%, #F5E2CB 52%, #EDD1B2 100%);
  box-shadow: 0 1px 3px rgba(122, 82, 48, .08), 0 8px 22px rgba(154, 107, 63, .16), inset 0 0 0 1px rgba(255, 255, 255, .6); }
.mi-hero::after { content: ""; position: absolute; right: -36px; top: -40px; width: 140px; height: 140px; border-radius: 50%; background: radial-gradient(circle, rgba(255, 255, 255, .55) 0%, rgba(255, 255, 255, 0) 70%); }
.mi-hero__ava { position: relative; z-index: 1; flex: 0 0 auto; width: 76px; height: 76px; border-radius: 50%; overflow: hidden; background: #FFF8EE; border: 3px solid var(--k-paper); box-shadow: 0 0 0 1px rgba(154, 107, 63, .22), 0 4px 12px rgba(122, 82, 48, .16); }
.mi-hero__img { width: 100%; height: 100%; }
/* 吉祥物版画布不是正方形：缩一点放在圆里，不被圆框裁掉耳朵 */
/* 头像右下角挂当前等级的小图标（30px），没上传头像时整块就是 76px 的等级图标 */
.mi-hero__ava-wrap { position: relative; z-index: 1; flex: 0 0 auto; }
.mi-hero__lv { position: absolute; right: -6px; bottom: -4px; }
.mi-hero__body { position: relative; z-index: 1; flex: 1; min-width: 0; display: flex; flex-direction: column; }
.mi-hero__top { display: flex; align-items: center; gap: 8px; min-width: 0; }
/* 等级名用衬线粗体（样稿）：只这一处，全站标题仍是黑体；手机里没有宋体时退回系统字体 */
.mi-hero__level { min-width: 0; font-family: var(--k-display-font); font-size: 28px; font-weight: 900; line-height: 1.2; letter-spacing: 1px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; } /* 10-19：等级名改用全站标题字体（思源黑体特粗），不再单独用宋体 */
.mi-hero__tag { flex: 0 0 auto; height: 20px; padding: 0 8px; border-radius: 10px; background: rgba(255, 255, 255, .7); color: #74502F; font-size: 11px; font-weight: 600; line-height: 20px; white-space: nowrap; }
.mi-hero__nick { margin-top: 2px; font-size: 14px; line-height: 1.5; color: #74502F; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.mi-hero__row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 4px; }
.mi-hero__pts { display: flex; align-items: baseline; gap: 6px; min-width: 0; font-size: 13px; color: #74502F; white-space: nowrap; }
.mi-hero__num { font-size: 22px; font-weight: 700; line-height: 1.2; color: var(--k-red-deep); }
.mi-hero__rules { flex: 0 0 auto; margin: -8px -2px -8px 0; padding: 8px 2px 8px 0; }
.mi-hero__rules-pill { display: flex; align-items: center; height: 28px; padding: 0 12px; border: 1px solid rgba(154, 107, 63, .6); border-radius: 999px; background: rgba(255, 255, 255, .55); color: #74502F; font-size: 12px; font-weight: 600; white-space: nowrap; }
/* 升级进度：橙色粗进度条，下面左「160/300」、右边升级提示 */
.mi-bar { height: 10px; border-radius: 5px; background: #F6E6D2; overflow: hidden; }
.mi-bar__fill { height: 100%; border-radius: 5px; background: linear-gradient(90deg, #F2B867 0%, #E58E3E 100%); }
.mi-prog { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 2px 12px; margin-top: 8px; }
.mi-prog__count { flex: 0 0 auto; font-size: 15px; font-weight: 700; color: #B76A28; }
.mi-prog__tip { flex: 0 1 auto; min-width: 0; font-size: 13px; line-height: 1.5; color: var(--k-ink2); }
.mi-ledger { display: block; margin-top: 6px; font-size: 12px; }
/* 会员等级：每格等宽，徽章圆心在每格正中：连线从第 1 格中心画到最后一格中心（左右各留半格），徽章底色盖住穿过它的那段线 */
.levels { position: relative; display: flex; align-items: flex-start; }
.levels__track { position: absolute; left: calc(100% / 12); right: calc(100% / 12); top: 21px; height: 3px; border-radius: 2px; background: var(--k-line); }
.levels__fill { height: 100%; border-radius: 2px; background: linear-gradient(90deg, #F2B867, #E58E3E); }
.levels__item { position: relative; flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 4px; }
/* 10-18：圆里放 level-icon（40px，自带等级圆环），这一层只负责盖住穿过的连线和「当前」那一圈橙色光环 */
.levels__ring { width: 44px; height: 44px; border-radius: 50%; background: var(--k-paper); display: flex; align-items: center; justify-content: center; }
.levels__ring.cur { box-shadow: 0 0 0 2px var(--k-paper), 0 0 0 4px #E58E3E; }
.levels__label { max-width: 100%; margin-top: 2px; padding: 0 2px; font-size: 12px; line-height: 20px; color: var(--k-ink2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
/* 当前等级：实心暖棕胶囊白字（样稿） */
.levels__label.cur { padding: 0 6px; border-radius: 10px; background: var(--k-red); color: var(--k-paper); font-weight: 600; }
.levels__pts { max-width: 100%; font-size: 11px; line-height: 1.4; color: var(--k-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
/* 我的权益：三张并排的小卡；当前等级那张暖色底 + 暖棕描边，还没到的徽章灰显 */
.mi-perks { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.mi-perk { display: flex; flex-direction: column; gap: 5px; min-width: 0; padding: 12px 8px 12px 10px; border-radius: 14px; background: var(--k-paper); box-shadow: var(--k-sh1); }
.mi-perk.cur { background: linear-gradient(170deg, #FBEFDF 0%, var(--k-paper) 75%); box-shadow: 0 0 0 1.5px rgba(154, 107, 63, .45), var(--k-sh1); }
.mi-perk__head { display: flex; align-items: center; justify-content: space-between; gap: 4px; }
.mi-perk__now { height: 18px; padding: 0 6px; border-radius: 9px; background: var(--k-red); color: var(--k-paper); font-size: 10px; line-height: 18px; white-space: nowrap; }
.mi-perk__title { font-size: 13px; font-weight: 700; line-height: 1.4; color: var(--k-ink); overflow-wrap: anywhere; }
.mi-perk__line { display: flex; align-items: flex-start; gap: 3px; font-size: 12px; line-height: 1.5; color: var(--k-ink2); }
.mi-perk__tick { flex: 0 0 auto; height: 18px; display: flex; align-items: center; }
.mi-perk__text { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.mi-perk__none { font-size: 12px; line-height: 1.5; color: var(--k-muted); }
/* 合作店权益条数：卡底单独一块，「3 项」大一号暖棕，下面一行小字（三张卡并排一张只有约 100px 宽，写成一句会折得很碎） */
.mi-perk__shop { display: flex; flex-direction: column; margin-top: auto; padding-top: 6px; border-top: 1px dashed rgba(154, 107, 63, .25); }
.mi-perk__shop-n { font-size: 16px; font-weight: 700; line-height: 1.3; color: var(--k-red-deep); }
.mi-perk__shop-t { font-size: 11px; line-height: 1.4; color: var(--k-muted); }
/* 赚取积分：两项一张白卡，中间一道细线；右边暖棕渐变「去完成」，做完的是浅色「已完成」 */
.mi-tasks { margin-top: 12px; padding: 4px 12px 4px 14px; }
.mi-task { display: flex; align-items: center; gap: 10px; min-height: 64px; padding: 8px 0; }
.mi-task + .mi-task { border-top: 1px solid var(--k-line); }
.mi-task__icon { flex: 0 0 auto; width: 38px; height: 38px; border-radius: 50%; background: var(--k-ochre-soft); display: flex; align-items: center; justify-content: center; }
.mi-task__main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.mi-task__top { display: flex; align-items: baseline; flex-wrap: wrap; gap: 0 8px; }
.mi-task__title { font-size: 15px; font-weight: 600; line-height: 1.4; color: var(--k-ink); white-space: nowrap; }
.mi-task__pts { font-size: 13px; font-weight: 700; color: #B76A28; white-space: nowrap; }
.mi-task__sub { font-size: 12px; line-height: 1.5; color: var(--k-muted); overflow-wrap: anywhere; }
/* 按钮本身 30px 高；外面这层透明，上下各 7px，点按区域 44px */
.mi-task__go { flex: 0 0 auto; margin: -7px 0; padding: 7px 0; }
.mi-task__btn { display: flex; align-items: center; height: 30px; padding: 0 14px; border-radius: 999px; background: linear-gradient(135deg, #AE7A46 0%, #9A6B3F 52%, #8A5E36 100%); box-shadow: 0 3px 8px rgba(138, 94, 54, .24); color: var(--k-paper); font-size: 13px; font-weight: 600; white-space: nowrap; }
.mi-task__btn.done { background: var(--k-paper2); box-shadow: none; color: var(--k-muted); }
/* 积分明细 */
.record { display: flex; align-items: center; gap: 8px; padding: 9px 0 2px; }
.record__pts { color: var(--k-red); font-size: 15px; font-weight: 600; }
/* 积分规则：纸张质感（米黄底、内圈虚线、右上角折角），一条一行，左边赭色大号编号 */
.mi-rules { position: relative; margin-top: 12px; padding: 16px 16px 10px; border-radius: var(--k-radius, 16px); overflow: hidden;
  background: linear-gradient(180deg, #FFFCF6 0%, #FBF3E5 100%);
  box-shadow: 0 1px 3px rgba(122, 82, 48, .06), 0 6px 16px rgba(122, 82, 48, .08), inset 0 0 0 1px rgba(201, 144, 67, .22); }
.mi-rules::before { content: ""; position: absolute; left: 6px; right: 6px; top: 6px; bottom: 6px; border: 1px dashed rgba(201, 144, 67, .35); border-radius: 12px; pointer-events: none; }
.mi-rules::after { content: ""; position: absolute; left: 50%; top: -5px; width: 88px; height: 22px; margin-left: -44px; background: rgba(232, 196, 142, .62); transform: rotate(-3deg); box-shadow: 0 1px 2px rgba(122, 82, 48, .12); } /* 10-19 参考图 12：顶部一条半透明胶带（之前是右上角折角） */
.mi-rules__title { position: relative; display: block; font-size: 17px; font-weight: 700; line-height: 1.4; color: #5E3D1F; }
.mi-rule { position: relative; display: flex; align-items: flex-start; gap: 10px; padding: 10px 0; }
.mi-rule + .mi-rule { border-top: 1px solid rgba(201, 144, 67, .2); }
/* 编号用系统黑体粗体、等宽数字（全站 10-16 起不再用 Georgia 衬线数字） */
.mi-rule__no { flex: 0 0 auto; width: 28px; font-family: var(--k-display-font); font-size: 18px; font-weight: 700; line-height: 1.3; font-variant-numeric: tabular-nums; color: #C27A35; }
.mi-rule__body { flex: 1; min-width: 0; font-size: 13px; line-height: 1.7; color: var(--k-ink2); overflow-wrap: anywhere; }
.mi-rule__name { font-weight: 700; color: var(--k-ink); }
@media (max-width: 359px) {
  /* 320 宽：头像 64px、等级名 22px；等级格只有约 43px，徽章缩到 38px、门槛 10px；权益卡字小一号 */
  .mi-hero { gap: 10px; padding: 16px 12px 14px; }
  .mi-hero__ava { width: 64px; height: 64px; }
  .mi-hero__level { font-size: 22px; letter-spacing: 0; }
  .mi-hero__num { font-size: 20px; }
  .mi-hero__rules-pill { padding: 0 9px; }
  .levels__ring { width: 40px; height: 40px; }
  .levels__track { top: 18px; }
  .levels__label { font-size: 11px; }
  .levels__label.cur { padding: 0 4px; }
  .levels__pts { font-size: 10px; }
  .mi-perks { gap: 6px; }
  .mi-perk { padding: 10px 6px 10px 8px; }
  .mi-perk__title { font-size: 12px; }
  .mi-perk__line, .mi-perk__none { font-size: 11px; }
  .mi-task__btn { padding: 0 11px; }
}

/* s4 */
.srow { display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 0 0 0 2px; }
/* 上下各留 8px：说明折成两行时（320 宽「谁可以私信我」）字不贴着卡片下沿；一行说明时仍是 64px */
.srow--tall { min-height: 64px; padding-top: 8px; padding-bottom: 8px; }
.srow.has-line { position: relative; }
.srow.has-line::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); transform-origin: 0 100%; }
/* 一行从左到右：图标、名字（不缩、不折行）、说明（占剩下的地方、靠右，放不下显示「…」）、箭头。
   之前名字是 flex:1、说明不缩：320 宽「注销账号」被挤成一字一行、「设备与登录」折成两行 */
.srow__label { flex: 0 0 auto; font-family: var(--k-display-font); font-weight: 700; font-size: 15px; white-space: nowrap; }
.srow__hint { flex: 1 1 0; min-width: 0; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.srow__hint.k-row { justify-content: flex-end; }
.srow__sub { display: flex; flex-wrap: wrap; }
.srow__sub text { white-space: nowrap; }
.card--group .srow:first-of-type { margin-top: 2px; }
@media (max-width: 340px) {
  /* 320 宽：间距收到 8px，「设备与登录」后面的「管理登录设备与记录」整句放得下 */
  .srow { gap: 8px; }
}
.logout { font-family: var(--k-display-font); font-weight: 700; font-size: 17px; }
/* ---------------------------------------------------------------------------------------------------------------
   2026-10-19 一比一还原（全局视觉语言 + 参考图 12 会员信息）：页面底暖米渐变；白卡圆角 20 + 柔阴影 + 细边；标题用标题字体。
   「我的」首屏的尺寸（资料卡、会员卡、宫格的高度）不动 —— 主人要求会员卡保持小、「内容与关注」首屏露全；这里只换质感
   --------------------------------------------------------------------------------------------------------------- */
.profile { --k-bg: #{$look-bg-top}; background: $look-bg; }
.card { border-radius: 20px; border: $look-hairline; box-shadow: $look-shadow; }
.me__name, .grid-card__title, .duo__title, .mi-title, .mi-rules__title, .staff__title { font-family: var(--k-display-font); font-weight: 700; }
.grid-card__title { font-size: 18px; }
.member-card { border-radius: 20px; border: 1px solid rgba(255, 255, 255, .7); }
.member-level { font-family: var(--k-display-font); font-weight: 700; }
.member-points__num { font-family: var(--k-display-font); font-weight: 700; }
.me__edit-pill { font-weight: 700; }
.duo__icon { background: linear-gradient(145deg, #FBF1E4 0%, #F1DCC0 100%); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .7); }
/* 会员信息（参考图 12）：顶部浅杏大卡圆角 24、等级名特粗、「普通会员」浅橙胶囊、积分大数字；「积分规则」描边胶囊 */
.mi-hero { border-radius: 24px; padding: 20px 16px 18px 18px; background: linear-gradient(125deg, #FDF4E8 0%, #F8E6CF 50%, #F1D5B4 100%); }
.mi-hero__tag { height: 22px; line-height: 22px; padding: 0 10px; border-radius: 11px; background: #FBE3C6; color: #8A5A30; font-weight: 700; }
.mi-hero__nick { margin-top: 4px; font-weight: 600; }
.mi-hero__row { margin-top: 10px; }
.mi-hero__num { font-family: var(--k-display-font); font-size: 26px; font-weight: 900; color: #8A5A30; }
.mi-hero__rules-pill { border-color: rgba(138, 90, 48, .55); color: #8A5A30; font-weight: 700; background: rgba(255, 255, 255, .7); }
.mi-sec { margin-top: 12px; }
.mi-title { font-size: 18px; }
.mi-card { padding: 16px; }
.mi-bar { height: 10px; background: #F7EADB; }
.mi-prog__count { font-family: var(--k-display-font); font-size: 18px; font-weight: 700; color: #C27A35; }
.levels__label.cur { font-weight: 700; padding: 0 5px; }
/* 我的权益三列卡：顶部一条浅色标题头（三张卡三种浅底：杏、豆绿、雾蓝），下面勾选列表 */
.mi-perk { position: relative; padding: 12px 8px 12px 10px; border-radius: 18px; border: $look-hairline; box-shadow: $look-shadow-sm; background: linear-gradient(180deg, #FBEBD8 0, #FBEBD8 74px, var(--k-paper) 74px); }
.mi-perk + .mi-perk { background: linear-gradient(180deg, #E8F1E2 0, #E8F1E2 74px, var(--k-paper) 74px); }
.mi-perk + .mi-perk + .mi-perk { background: linear-gradient(180deg, #E7EDF2 0, #E7EDF2 74px, var(--k-paper) 74px); }
.mi-perk.cur { box-shadow: 0 0 0 1.5px rgba(154, 107, 63, .5), $look-shadow-sm; }
.mi-perk__title { min-height: 24px; font-family: var(--k-display-font); font-size: 13px; font-weight: 700; color: $look-ink; }
.mi-perk__line { margin-top: 2px; }
.mi-perk__shop-n { font-family: var(--k-display-font); font-weight: 700; }
/* 赚取积分：两张白卡，每项 图标（浅杏圆底）、任务名粗、「+N积分」橙字，右边暖棕渐变「去完成」 */
.mi-tasks { border-radius: 20px; padding: 4px 14px 4px 14px; }
.mi-task__icon { width: 40px; height: 40px; background: linear-gradient(145deg, #FDF0DF 0%, #F6DFC2 100%); }
.mi-task__title { font-weight: 700; }
.mi-task__pts { color: #C27A35; }
.mi-task__btn { padding: 0 16px; background: $look-grad-brown; font-weight: 700; }
/* 积分规则：纸张质感 + 顶部胶带（见上面 .mi-rules::after），标题居中 */
.mi-rules { margin-top: 16px; padding: 22px 16px 10px; border-radius: 20px; overflow: visible; }
.mi-rules__title { text-align: center; font-size: 18px; color: #5E3D1F; }
/* 320 宽：上面这段覆盖后再收一档 —— 积分数字、等级名小一号，「当前积分」不竖着折；当前等级胶囊收窄，「小袋鼠」三个字放得下 */
@media (max-width: 359px) { .mi-hero__level { font-size: 22px; } .mi-hero__num { font-size: 20px; } .mi-hero__pts { flex: 0 0 auto; } .levels__label.cur { padding: 0 3px; letter-spacing: -.3px; } }
/* 10-19 复查（320 宽）：常用下面两张大入口各只有约 139px 宽，之前「简历与机会」被省略成「简历与…」、说明也被截断 ——
   图标缩到 32px、内边距和间距收窄、说明 11px，标题和说明都放得下；会员等级六格每格约 43px，门槛「2000积分5000积分」挤成一串 —— 窄屏只写「2000分」 */
@media (max-width: 359px) { .duo__item { gap: 7px; padding: 10px 6px 10px 8px; } .duo__icon { width: 32px; height: 32px; } .duo__img { width: 22px; height: 22px; } .duo__sub { font-size: 11px; } .levels__ji { display: none; } }
@import './membership.scss';
@import './profile-screens.scss';
@import './profile-home.scss';
</style>

<style scoped>
/* 2026-11-17 改版「小而精」：员工 / 商家身份的首屏收小一档（头像 52、名字 17）；11-18 第二轮：链接行 48 高 14 字、12 号灰箭头、行间发丝线（最后一行下面不画） */
.staff-account__identity{display:flex;align-items:center;gap:12px;padding:14px 12px}.staff-account__identity image{width:52px;height:52px;border-radius:50%}.staff-account__identity>view{display:flex;flex-direction:column;gap:4px;min-width:0;font-size:20px;font-weight:700;line-height:28px}.staff-account__identity .k-meta{font-size:12px;font-weight:400;line-height:17px}.staff-account__links{margin-top:8px}
</style>

<style scoped>
/* 2026-11-17 改版「小而精」：微信头像按钮上下留白（之前是 0，头像贴着卡片上沿）；说明 12 字；保存钮 44 高暖棕渐变胶囊 */
.avatar-wechat{padding:16px 0 10px;border:0;background:transparent;line-height:1.5;display:flex;flex-direction:column;align-items:center}.avatar-wechat::after{border:0}
.wechat-profile-hint{display:block;font-size:12px;line-height:1.6;color:var(--k-muted);margin:2px 0 0}
.profile-save{width:100%;border-radius:22px;background:linear-gradient(135deg,#B5814D,#8E5E33);color:var(--k-paper);font-size:15px;font-weight:600;line-height:44px}.profile-save[disabled]{opacity:.45}
</style>

<style scoped lang="scss">
.profile.user-surface .mine {
  .me { gap: 11px; }
  .me__avatar { border: 2px solid var(--k-paper); box-shadow: 0 0 0 1px var(--k-line); }
  .me__no { font-variant-numeric: tabular-nums; }
  .me__edit-pill { border-radius: 9px; background: var(--k-paper); color: var(--k-red-deep); }
  .member-card { padding: 8px 11px; background: #FAF0E1; border-radius: 12px; box-shadow: inset 0 0 0 1px #EFDECA; }
  .member-mascot { margin-left: -3px; }
  .member-points__num { color: var(--k-red-deep); }
  .grid-card--all { background: var(--k-paper); }
  .grid-card--all .grid-card__title { color: var(--k-ink); }
  .grid-card--all .grid-wrap + .grid-wrap .grid-group { margin: 10px 0 0; padding-top: 11px; background: linear-gradient(var(--k-line),var(--k-line)) 12px top / calc(100% - 24px) 1px no-repeat; }
  .grid-card--all .grid { margin-top: 8px; }
  .cell__icon { width: 40px; height: 40px; border-radius: 10px; background: var(--user-icon-field); }
  .cell__badge { left: 29px; }
}
@media (max-width: 359px) { .profile.user-surface .mine .member-card { gap: 6px; padding: 7px 8px; } }
</style>
