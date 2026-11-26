<template>
  <!-- #ifdef MP-WEIXIN -->
  <page-meta :page-style="datePick ? 'overflow: hidden' : ''" />
  <!-- page-meta 必须是页面第一个节点。日历开着时锁住页面滚动（弹框里的 scroll-view 不能用 catchtouchmove 拦，拦了它自己也滑不动）。
       只在小程序里加：H5 的 page-meta 关弹窗时清不掉这条样式。2026-11-03 设施改成直接摊开点选，不再有设施弹层 -->
  <!-- #endif -->
  <view class="k-page rooms">
    <k-topbar :title="titles[s - 1]" back custom-back :fab="s === 1 || s === 5" @back="onBack" />

    <!-- 1 房源列表 -->
    <view v-if="s === 1" class="k-body list-body">
      <view class="filters">
        <view class="dd" @click="sourceTip"><text>{{ opLabel }}</text><k-icon name="chevron-down" :size="12" color="muted" :stroke="1.8" /></view>
        <view class="dd" @click="pickStatus"><text>{{ statusText }}</text><k-icon name="chevron-down" :size="12" color="muted" :stroke="1.8" /></view>
        <view class="k-flex1" />
        <view class="filters__icon" @click="askKeyword"><k-icon name="search" :size="18" color="ink" :stroke="1.8" /></view>
        <view class="filters__filter" @click="moreFilter"><k-icon name="filter" :size="16" color="ink" :stroke="1.8" /><text>筛选</text></view>
      </view>
      <view class="stats">
        <view class="stats__item"><text class="stats__num">{{ (data.stats || {}).stays || 0 }}</text><text class="stats__label">房源总数</text></view>
        <view class="stats__line" />
        <view class="stats__item"><text class="stats__num">{{ ((data.stats || {}).occupancy || 0) + '%' }}</text><text class="stats__label">平均入住率</text></view>
        <view class="stats__line" />
        <view class="stats__item"><text class="stats__num">{{ (data.stats || {}).todayOrders || 0 }}</text><text class="stats__label">今日订单</text></view>
      </view>
      <view class="tabs">
        <view v-for="t in tabs" :key="t" class="tabs__item" :class="{ active: tab === t }" @click="setTab(t)"><text>{{ t }}</text></view>
      </view>
      <!-- 2026-11-03 主人：「设计太弱智了弄到一起，我需要退出来登进去来回点击」「增加个单独的二级页操作方便简单一些」：
           操作按钮从右边窄栏挪到卡片下面整行，五个一样大、图标在上字在下、每个 56px 高；「房型管理」从「更多」里拿出来单独一个按钮，
           进新的二级页（room-types.vue：房型列表、新增、修改、7 天价格都在那一页，不再连着弹框）。「更多」只放不常用的 -->
      <view v-for="(r, i) in rooms" :key="r.stayId" class="room" :class="{ 'is-last': i === rooms.length - 1 }">
        <view class="room__main">
          <image class="room__img" :src="r.img" mode="aspectFill" />
          <view class="k-flex1">
            <view class="k-between">
              <text class="room__name">{{ r.name }}</text>
              <view class="room__chip"><k-chip :tone="r.tone">{{ r.status }}</k-chip></view>
            </view>
            <text class="room__addr">{{ r.addr }}</text>
            <view v-if="r.rate" class="room__kpi">
              <text class="room__kpi-label">入住率</text><text class="room__kpi-val">{{ r.rate }}</text>
              <view class="room__kpi-line" />
              <text class="room__kpi-label">今日订单</text><text class="room__kpi-val">{{ r.orders }}</text>
            </view>
            <text v-else class="room__addr room__note">{{ r.note }}</text>
          </view>
        </view>
        <!-- 2026-11-03 主人：简化「更多」。第四个按钮按状态变：草稿 / 驳回 / 已下架 →「提交审核」、上线中 →「下架」、审核中 →「审核中」（看进度）；
             原来的「数据」在「更多 → 上传 Vlog」那一页的「数据」标签里还能看。「房态」直接进房型页第三屏（14 天小表），不再连弹 5 个系统框 -->
        <view v-if="r.actions" class="room__actions">
          <view class="room__act" hover-class="k-press" @click="openEdit(r)"><k-icon name="pencil" :size="20" color="ink" :stroke="1.8" /><text>{{ ['draft','rejected','offline'].includes(r.rawStatus) ? '继续上架' : '编辑房源' }}</text></view>
          <view class="room__act" hover-class="k-press" @click="openRoomTypes(r)"><k-icon name="bed-double" :size="20" color="ink" :stroke="1.8" /><text>房型管理</text></view>
          <view class="room__act" hover-class="k-press" @click="openCalendar(r)"><k-icon name="calendar-check" :size="20" color="ink" :stroke="1.8" /><text>房态</text></view>
          <view class="room__act room__act--main" hover-class="k-press" @click="statusAction(r)"><k-icon :name="r.actionIcon" :size="20" color="#8A5E36" :stroke="1.8" /><text>{{ r.actionLabel }}</text></view>
          <view class="room__act" hover-class="k-press" @click="moreActions(r)"><k-icon name="ellipsis" :size="20" color="ink" :stroke="2" /><text>更多</text></view>
        </view>
        <!-- 下架原因就在卡片下面填（原来是系统输入框）：写一句、点「确认下架」 -->
        <view v-if="offlineBox && offlineBox.stayId === r.stayId" class="room__offline">
          <text class="room__offline-t">下架「{{ r.name }}」：写一句原因，住客就订不到了，已有订单照常</text>
          <input v-model="offlineBox.reason" class="fc-input" maxlength="100" placeholder="例如：房源整改中" placeholder-class="fc-ph" />
          <view class="room__offline-btns">
            <view class="room__obtn room__obtn--ghost" hover-class="k-press-s" @click="offlineBox = null"><text>先不下架</text></view>
            <view class="room__obtn" hover-class="k-press-s" @click="confirmOffline"><text>确认下架</text></view>
          </view>
        </view>
      </view>
      <view class="fab-bar"><k-button block icon="plus" @click="newStay" :label="newStayLabel" /></view>
      <k-tabbar mode="staff" active="work" />
    </view>

    <!-- 2 新增/编辑房源（2026-10-31 R7 改版，主人：看起来很乱，用的人有年龄大的，要干净成熟）：一组一块通栏白底，样式 form-clean.scss。字段一个没少。
         原来的五步圈是假的（后四步没有页面），换成一句话，步数按真实流程（steps3）；不常用的收进「更多选填」，打开时里面已有内容就默认展开 -->
    <template v-else-if="s === 2">
      <view class="fc-form">
        <view class="fc-steps"><text class="fc-steps__t">1 / 3 · 基本信息</text><text>下一步设置房型与价格</text></view>
        <text class="fc-footnote">保存草稿不会上架。资料补齐后统一提交平台审核。</text>
        <!-- 10-19 复查（主人：「只能填一个主理人信息吗还是显示需要下架才能保存和更改」）：上线中 / 审核中的房源，一进来就说清哪些能直接改、哪些要先下架，
             不用等点了保存才知道（能直接改的几项是服务端给的 directEditable，和保存时的判断同一份） -->
        <text v-if="editableTip" class="fc-notice">{{ editableTip }}</text>
        <view class="fc-block">
          <text class="fc-group__title">房源信息</text>
          <view id="rf-name" class="fc-field">
            <view class="fc-label"><text class="fc-label__t">房源名称</text><text class="fc-req">必填</text><text class="fc-count">{{ form.name.length }}/30</text></view>
            <input v-model="form.name" class="fc-input" :class="{ 'fc-input--err': rerr.name }" maxlength="30" placeholder="请输入房源名称" placeholder-class="fc-ph" />
            <text v-if="rerr.name" class="fc-err">{{ rerr.name }}</text>
          </view>
          <view id="rf-addr" class="fc-field">
            <view class="fc-label"><text class="fc-label__t">房源地址</text><text class="fc-req">必填</text></view>
            <input v-model="form.addr" class="fc-input" :class="{ 'fc-input--err': rerr.addr }" maxlength="100" placeholder="请输入详细地址" placeholder-class="fc-ph" @input="addressChanged" />
            <text v-if="rerr.addr" class="fc-err">{{ rerr.addr }}</text>
          </view>
          <view class="fc-row" hover-class="k-press" @click="pickFormLocation"><view class="fc-row__copy fc-row__copy--fit"><text class="fc-row__k">{{ locationButtonLabel }}</text><text class="fc-row__sub">选好后住客可以导航到店</text></view><text class="fc-row__v" :class="{ 'fc-row__v--empty': !formPoint }">{{ formPoint ? '已选好，保存后生效' : '未设置' }}</text><k-icon name="chevron-right" :size="18" color="muted" /></view>
          <!-- 2026-10-17 R2（小院列表「位置」、详情「小院主理人」）：所在区县从这座城市的区县里选（字典里没有的也能手填） -->
          <view class="fc-row" hover-class="k-press" @click="pickDistrict"><text class="fc-row__k">所在区县</text><text class="fc-row__v" :class="{ 'fc-row__v--empty': !form.district }">{{ form.district || '请选择' }}</text><k-icon name="chevron-right" :size="18" color="muted" /></view>
          <!-- 2026-11-03 主人：简化「更多」——原来「更多 → 编辑商圈与位置」要连弹两个系统输入框，现在就是表单里两个输入框，随表单一起保存 -->
          <view class="fc-field">
            <view class="fc-label"><text class="fc-label__t">商圈</text><text class="fc-count">{{ form.area.length }}/32</text></view>
            <input v-model="form.area" class="fc-input" maxlength="32" placeholder="例如：大理古城" placeholder-class="fc-ph" />
          </view>
          <view class="fc-field">
            <view class="fc-label"><text class="fc-label__t">位置描述</text><text class="fc-count">{{ form.areaDesc.length }}/64</text></view>
            <input v-model="form.areaDesc" class="fc-input" maxlength="64" placeholder="例如：步行3分钟到洱海" placeholder-class="fc-ph" />
          </view>
          <!-- 运营类型由平台按门店签约设置，这里只读：不画成能选的样子，点了说明一句 -->
          <view class="fc-row" hover-class="k-press" @click="typeTip"><text class="fc-row__k">来源类型</text><text class="fc-row__v fc-row__v--plain">{{ form.type || '—' }}</text></view>
          <!-- 2026-11-03 主人：简化「更多」——「更换封面」并进表单：点一下选图、马上传好，随表单一起保存（新房源也能先把封面选好） -->
          <view class="fc-field">
            <view class="fc-label"><text class="fc-label__t">房源封面</text><text class="fc-count">{{ coverUploading ? '正在上传…' : (form.cover ? '已选好' : '提交审核前要有') }}</text></view>
            <view class="fc-cover-row"><view class="fc-cover" hover-class="k-press-s" @click="pickFormCover"><image v-if="form.cover" class="fc-photo__img" :src="absUrl(form.cover)" mode="aspectFill" /><view v-else class="fc-photo__add"><k-icon name="plus" :size="24" color="ink2" :stroke="1.8" /><text>上传</text></view></view><text class="fc-note">{{ form.cover ? '点图片可以更换' : '一张房源实景照片，住客在列表里先看到它' }}</text></view>
          </view>
        </view>
        <view class="fc-block">
          <text class="fc-group__title">主理人与介绍</text>
          <view class="fc-row" hover-class="k-press" @click="editHost"><view class="fc-row__copy fc-row__copy--fit"><text class="fc-row__k">主理人</text><text class="fc-row__sub">{{ hostPhone }}</text></view><text class="fc-row__v">{{ form.hostName || '当地主理人' }}</text><k-icon name="chevron-right" :size="18" color="muted" /></view>
          <view class="fc-field">
            <view class="fc-label"><text class="fc-label__t">房源简介</text><text class="fc-req">必填</text><text class="fc-count">{{ form.desc.length }}/200</text></view>
            <!-- 原生 textarea 会盖住底部固定的「保存草稿 / 下一步」和导航栏，不在输入时只显示同样大小的文字块 -->
            <textarea v-if="editingDesc" v-model="form.desc" class="fc-area fc-area--short" :maxlength="200" :placeholder="DESC_HINT" placeholder-class="fc-ph" :focus="true" auto-focus @blur="form.desc = $event.detail.value; editingDesc = false" />
            <view v-else class="fc-area fc-area--short fc-area--idle" hover-class="k-press" @click="editingDesc = true"><text :class="{ 'fc-ph': !form.desc }">{{ form.desc || DESC_HINT }}</text></view>
          </view>
          <!-- 配套设施（2026-10-17 R2）：选项读设施字典 kg_stay_facility（含学习室 / 健身房，2026-11-03 V70 补了地暖）+ 房源的「可做饭」；
               小院列表「房型」面板的配套设施、详情页设施图标都按这里勾的显示。
               2026-11-03 主人：「增加一个对勾，你点一下对勾就选中，能清楚的看到我选了那个」：不再点开底部弹层，选项直接摊在这里，
               点一下就选中：选中 = 暖棕底白字 + 白色对勾；没选 = 浅底 + 空心圆圈。再点一下取消 -->
          <view class="fc-field">
            <view class="fc-label"><text class="fc-label__t">配套设施</text><text class="fc-count">已选 {{ facNames.length }} 项</text></view>
            <view class="fac-chips">
              <view v-for="o in facChoices" :key="o.value" class="fac-chip" :class="{ 'fac-chip--on': facPicked(o.value) }" hover-class="k-press-s" @click="tapFacility(o.value)">
                <view class="fac-chip__mark"><k-icon v-if="facPicked(o.value)" name="check" :size="14" color="#8A5E36" :stroke="3" /></view>
                <text>{{ o.label }}</text>
              </view>
            </view>
          </view>
        </view>
        <view class="fc-block">
          <view class="fc-more" :class="{ 'fc-more--open': moreOpen }" hover-class="k-press" @click="moreOpen = !moreOpen">
            <view class="fc-more__copy"><text class="fc-more__t">更多选填<text class="fc-more__n">（8 项{{ moreFilled ? '，已填 ' + moreFilled + ' 项' : '' }}）</text></text><text v-if="!moreOpen" class="fc-more__sum">标签、主理人年龄籍贯擅长、出行参考</text></view>
            <view class="fc-more__act"><text>{{ moreOpen ? '收起' : '展开' }}</text><k-icon :name="moreOpen ? 'chevron-up' : 'chevron-down'" :size="18" color="#8A5E36" /></view>
          </view>
          <view v-if="moreOpen">
            <view class="fc-field">
              <view class="fc-label"><text class="fc-label__t">标签</text><text class="fc-count">{{ form.tags.length }}/6</text></view>
              <view class="fc-tags">
                <view v-for="t in form.tags" :key="t" class="fc-tag"><text>{{ t }}</text><view class="fc-tag__x" hover-class="k-press" @click="removeTag(t)"><k-icon name="x" :size="15" color="muted" :stroke="2" /></view></view>
                <view class="fc-tag fc-tag--add" hover-class="k-press" @click="addTag"><k-icon name="plus" :size="16" color="#8A5E36" /><text>添加标签</text></view>
              </view>
            </view>
            <!-- 主理人年龄 / 籍贯 / 擅长：都是选填，填了才在房源详情页显示。
                 2026-11-03 主人：简化——原来每一项点开弹一个系统输入框（7 项 = 7 个弹窗），现在和「房源简介」一样，就是页面里的输入框，直接填 -->
            <view v-for="f in HOST_FIELDS" :key="f.key" class="fc-field">
              <view class="fc-label"><text class="fc-label__t">主理人{{ f.label }}</text><text class="fc-count">{{ form[f.key].length }}/{{ f.max }}</text></view>
              <input v-model="form[f.key]" class="fc-input" :maxlength="f.max" :placeholder="f.placeholder" placeholder-class="fc-ph" />
            </view>
            <!-- 出行参考（2026-10-17 R2）：主人拍板不接大模型，员工按实际情况手填四段；房源详情页「出行参考」卡只显示填了的那几行 -->
            <text class="fc-footnote">下面四段是出行参考，住客在房源详情页能看到，没填的不显示。</text>
            <view v-for="f in TRAVEL_FIELDS" :key="f.key" class="fc-field">
              <view class="fc-label"><text class="fc-label__t">{{ f.label }}</text><text class="fc-count">{{ form[f.key].length }}/{{ f.max }}</text></view>
              <!-- 和房源简介一样：原生 textarea 会盖住底部操作条，不在输入时只显示同样大小的文字块 -->
              <textarea v-if="editingField === f.key" v-model="form[f.key]" class="fc-area fc-area--short" :maxlength="f.max" :placeholder="f.placeholder" placeholder-class="fc-ph" :focus="true" auto-focus @blur="form[f.key] = $event.detail.value; editingField = ''" />
              <view v-else class="fc-area fc-area--short fc-area--idle" hover-class="k-press" @click="editingField = f.key"><text :class="{ 'fc-ph': !form[f.key] }">{{ form[f.key] || f.placeholder }}</text></view>
            </view>
          </view>
        </view>
      </view>
      <view class="fc-bar"><view class="fc-bar__btns"><fc-kefu /><view class="fc-btn fc-btn--ghost" hover-class="k-press-s" @click="saveStay(false)"><text>保存草稿</text></view><view class="fc-btn" hover-class="k-press-s" @click="saveStay(true)"><text>下一步</text></view></view></view>
    </template>

    <!-- 3 资质上传与审核（2026-10-31 R7）：每份资质两行，点第一行传 / 换文件，点第二行改有效期；提交按钮放进操作条 -->
    <template v-else-if="s === 3">
      <view class="fc-form">
        <view class="fc-steps"><text class="fc-steps__t">3 / 3 · 资质与提交</text><text>补齐后统一提交审核</text></view>
        <view class="fc-block">
          <view class="fc-row" hover-class="k-press" @click="editSubmissionBasics"><view class="fc-row__copy"><text class="fc-row__k">{{ stayInfo.stayName || '房源基本信息' }}</text><text class="fc-row__sub">{{ stayInfo.address || '请填写详细地址' }}</text></view><text class="submission-link">修改信息</text><k-icon name="chevron-right" :size="18" color="muted" /></view>
          <view id="submission-cover" class="fc-row" :hover-class="submissionEditable ? 'k-press' : ''" @click="uploadSubmissionCover">
            <view class="fc-row__copy"><text class="fc-row__k">房源封面<text class="fc-req">必填</text></text><text class="fc-row__sub">{{ coverUploading ? '正在上传，请稍候' : (stayInfo.cover ? '已保存' : '上传一张房源实景照片') }}</text></view>
            <image v-if="stayInfo.cover" class="submission-cover" :src="absUrl(stayInfo.cover)" mode="aspectFill" />
            <text v-if="submissionEditable" class="submission-link">{{ stayInfo.cover ? '更换' : '上传封面' }}</text>
          </view>
        </view>
        <view id="submission-rooms" class="fc-block">
          <text class="fc-group__title">房型信息</text>
          <text class="fc-footnote">房型名称、可住人数、间数和 7 天的价格随房源一起审核。审核通过前不会对住客开放预订。</text>
          <view v-for="room in stayInfo.roomTypes || []" :key="room.roomTypeId" class="fc-row">
            <view class="fc-row__copy"><text class="fc-row__k">{{ room.typeName }}</text><text class="fc-row__sub">{{ weekPriceText(room) }} · {{ room.capacity }} 人 · {{ room.stock }}{{ room.unitLabel || '间' }} · {{ String(room.status) === '0' ? '可用' : '已停用' }}</text></view>
          </view>
          <!-- 2026-11-03：新增 / 修改房型都进单独的「房型和价格」页（7 天价格一天一格）；那一页保存后回到这里自动刷新（onShow），不用退出去再进来 -->
          <view v-if="submissionEditable" class="fc-row" hover-class="k-press" @click="openRoomTypes({ stayId: editingId })"><k-icon name="plus" :size="20" color="#8A5E36" /><text class="submission-link">{{ (stayInfo.roomTypes || []).length ? '新增或修改房型、7 天价格' : '新增房型' }}</text><view class="k-flex1" /><k-icon name="chevron-right" :size="18" color="muted" /></view>
        </view>
        <text class="fc-group__title">资质材料</text>
        <text class="fc-footnote">请上传清晰、完整的资质图片或PDF，支持 JPG/PNG/PDF 格式，图片不超过20MB、PDF不超过10MB。</text>
        <text class="fc-footnote">营业执照上传后会自动添加“仅用于袋鼠认证”水印。</text>
        <view v-for="d in docs" :key="d.type" class="fc-block">
          <view class="fc-row" hover-class="k-press" @click="tapDoc(d)"><view class="fc-row__copy fc-row__copy--fit doc-name"><view class="fc-row__head"><text class="fc-row__k">{{ d.title }}{{ d.hint }}</text><text v-if="d.required" class="fc-req">必填</text></view><text v-if="d.uploaded" class="fc-row__sub doc-file">{{ d.file }} · {{ d.size }}</text></view><text class="fc-row__v" :class="{ 'fc-row__v--empty': !d.uploaded, 'doc-expired': d.expired }">{{ d.state }}</text><k-icon name="chevron-right" :size="18" color="muted" /></view>
          <view class="fc-row" hover-class="k-press" @click="editExpire(d)"><text class="fc-row__k">有效期至</text><text class="fc-row__v" :class="{ 'fc-row__v--empty': !d.uploaded }">{{ d.expire }}</text><k-icon name="chevron-right" :size="18" color="muted" /></view>
        </view>
        <view class="fc-block">
          <text class="fc-group__title">审核进度</text>
          <view class="timeline">
            <view v-for="(t, i) in timeline" :key="t.title" class="timeline__item">
              <view class="timeline__track">
                <view v-if="i > 0" class="timeline__line timeline__line--l" :class="{ done: t.done }" />
                <view v-if="i < timeline.length - 1" class="timeline__line timeline__line--r" :class="{ done: timeline[i + 1].done }" />
                <view class="timeline__dot" :class="{ done: t.done }"><k-icon :name="t.done ? 'check' : 'chevron-right'" :size="t.done ? 12 : 14" :color="t.done ? 'white' : 'muted'" :stroke="t.done ? 3 : 2" /></view>
              </view>
              <text class="timeline__title">{{ t.title }}</text>
              <text class="timeline__time">{{ t.time }}</text>
            </view>
          </view>
        </view>
        <view v-if="rejectBox" class="fc-notice" :class="{ 'fc-notice--alert': rejectBox.alert }">
          <text class="doc-result">{{ rejectBox.title }}<text v-if="rejectBox.time" class="doc-result__time">（{{ rejectBox.time }}）</text></text>
          <text>{{ rejectBox.desc }}</text>
        </view>
        <view v-if="submissionEditable && submissionMissing.length" class="fc-notice"><text class="doc-result">还需补充</text><text v-for="item in submissionMissing" :key="item" class="submission-missing">· {{ item }}</text></view>
        <merchant-agreement v-if="merchantStaff" ref="stayAgreement" :store-id="currentStaffStoreId()" type="stay" />
        <text v-if="submissionError" class="fc-err">{{ submissionError }}</text>
      </view>
      <!-- 审核中、已上线时没有要提交的：别的角色不出操作条；商家留着客服方块（浮动小钮在这一屏会压字） -->
      <view v-if="rejectBox.btn || merchantStaff" class="fc-bar"><view class="fc-bar__btns"><fc-kefu /><view v-if="rejectBox.btn" class="fc-btn" hover-class="k-press-s" @click="resubmit"><text>{{ rejectBox.btn }}</text></view></view></view>
    </template>

    <!-- 5 视频与生活碎片（2026-10-17 旅居改版 R3，V53）：小院视频（详情页「3分钟看小院」）、房型短视频（≤1分钟）、生活碎片（顶部背景图 / 标题 / 文案 + 每一条照片或视频）。
         主人拍板：这些是补充展示内容，上线中的房源也能直接改，不用下架重审；视频 mp4 / mov、60 秒、200MB 以内（分段上传，见 stay-video.js） -->
    <view v-else-if="s === 5" class="k-body media-body">
      <view v-if="mediaNote" class="notice"><text>{{ mediaNote }}</text></view>
      <text class="sec-title">小院视频 · 3分钟看小院</text>
      <view class="mcard">
        <view class="mcard__cover" hover-class="k-press-s" @click="tapIntroVideo">
          <image v-if="media.introVideo.url" class="mcard__img" :src="mediaThumb(media.introVideo.cover || media.cover)" mode="aspectFill" />
          <view v-if="media.introVideo.url" class="mcard__play"><k-icon name="play" :size="20" color="white" fill /></view>
          <view v-else class="mcard__empty"><k-icon name="video" :size="28" color="muted" :stroke="1.6" /><text>还没有小院视频，点这里上传</text></view>
        </view>
        <view class="mcard__acts">
          <view class="mact" hover-class="k-press-s" @click="uploadIntroVideo"><text>{{ media.introVideo.url ? '换视频' : '上传视频' }}</text></view>
          <view v-if="media.introVideo.url" class="mact" hover-class="k-press-s" @click="changeIntroCover"><text>换封面</text></view>
          <view v-if="media.introVideo.url" class="mact mact--del" hover-class="k-press-s" @click="removeIntroVideo"><text>删除</text></view>
        </view>
        <text class="trip-hint">{{ videoTip }}</text>
      </view>

      <text class="sec-title k-mt20">房型视频 · ≤1分钟</text>
      <text v-if="!media.roomTypes.length" class="trip-hint">还没有房型，先点房源卡片上的「房型管理」新增</text>
      <view v-for="roomItem in media.roomTypes" :key="roomItem.roomTypeId" class="mrow">
        <view class="mrow__thumb" hover-class="k-press-s" @click="tapRoomVideo(roomItem)"><image class="mcard__img" :src="mediaThumb(roomItem.videoCover || roomItem.cover || media.cover)" mode="aspectFill" /><view v-if="roomItem.videoUrl" class="mcard__play mcard__play--sm"><k-icon name="play" :size="12" color="white" fill /></view></view>
        <view class="k-flex1 mrow__copy"><text class="mrow__name">{{ roomItem.typeName }}</text><text class="mrow__state" :class="{ 'k-green': roomItem.videoUrl }">{{ roomItem.videoUrl ? '已有视频' : '还没有视频' }}</text></view>
        <view class="mact" hover-class="k-press-s" @click="manageRoomVideo(roomItem)"><text>{{ roomItem.videoUrl ? '管理' : '上传' }}</text></view>
      </view>

      <text class="sec-title k-mt20">近期生活碎片</text>
      <text class="trip-hint">顶部背景图、标题、介绍和每条照片 / 视频都在这里维护，仅展示在当前小院。</text>
      <image v-if="media.diary.bg || media.cover" class="diary-bg-preview" :src="mediaThumb(media.diary.bg || media.cover)" mode="aspectFill" @click="changeDiaryBg" />
      <view class="picks k-mt10">
        <view class="pick" hover-class="k-press" @click="changeDiaryBg"><text class="pick__k">背景图</text><text class="pick__val k-flex1" :class="{ 'pick__val--empty': !media.diary.bg }">{{ media.diary.bg ? '已上传，点击更换' : '未上传，默认用房源封面' }}</text><k-icon name="chevron-right" :size="12" color="muted" :stroke="1.8" /></view>
        <view class="pick" hover-class="k-press" @click="editDiaryTitle"><text class="pick__k">标题</text><text class="pick__val k-flex1" :class="{ 'pick__val--empty': !media.diary.title }">{{ media.diary.title || (media.diary.defaultTitle || '小院日记') + '（默认）' }}</text><k-icon name="chevron-right" :size="12" color="muted" :stroke="1.8" /></view>
        <view class="pick" hover-class="k-press" @click="editDiarySubtitle"><text class="pick__k">副标题</text><text class="pick__val k-flex1" :class="{ 'pick__val--empty': !media.diary.subtitle }">{{ media.diary.subtitle || media.diary.defaultSubtitle || '把日子过成一段可以翻看的记忆（默认）' }}</text><k-icon name="chevron-right" :size="12" color="muted" :stroke="1.8" /></view>
        <view class="pick" hover-class="k-press" @click="editDiaryIntro"><text class="pick__k">文案</text><text class="pick__val k-flex1" :class="{ 'pick__val--empty': !media.diary.intro }">{{ diaryIntroText || '未填写，默认一句「这里是小院的真实日常」' }}</text><k-icon name="chevron-right" :size="12" color="muted" :stroke="1.8" /></view>
      </view>
      <!-- 2026-11-03 主人：简化生活碎片。原来点「添加」要连着弹 3 个框（照片还是视频 / 写一句话 / 日期），点一条又弹 6 项菜单。
           现在：「添加照片」「添加视频」两个大钮，选完文件直接在列表顶部出一张卡，一句话和拍摄日期（默认今天）就在卡上填、点「保存」；
           每张卡上一句话直接改、日期点一下改、「上移 / 下移 / 删除」小钮（删除保留一次确认），点图预览 -->
      <view class="dadd">
        <view class="dadd__btn" hover-class="k-press-s" @click="addDiary('image')"><k-icon name="image-plus" :size="22" color="#8A5E36" :stroke="1.8" /><text>添加照片</text></view>
        <view class="dadd__btn" hover-class="k-press-s" @click="addDiary('video')"><k-icon name="video" :size="22" color="#8A5E36" :stroke="1.8" /><text>添加视频（{{ VIDEO_MAX_SECONDS }} 秒内）</text></view>
      </view>
      <view v-if="diaryDraft" class="dcard dcard--new">
        <view class="dcard__top">
          <view class="dcard__thumb" hover-class="k-press-s" @click="previewDraft"><image class="mcard__img" :src="mediaThumb(diaryDraft.cover || diaryDraft.url)" mode="aspectFill" /><view v-if="diaryDraft.mediaType === 'video'" class="mcard__play mcard__play--sm"><k-icon name="play" :size="12" color="white" fill /></view></view>
          <view class="k-flex1 dcard__fields">
            <text class="dcard__tag">新的一条，还没保存</text>
            <input v-model="diaryDraft.caption" class="dcard__input" maxlength="32" placeholder="写一句话，如：火烧云、早餐（可以不写）" placeholder-class="d-ph" />
            <view class="dcard__date" hover-class="k-press" @click="pickDraftDate"><k-icon name="calendar" :size="16" color="muted" :stroke="1.8" /><text>拍摄日期 {{ diaryDraft.shotDate }}</text><k-icon name="chevron-right" :size="14" color="muted" :stroke="1.8" /></view>
          </view>
        </view>
        <view class="dcard__btns">
          <view class="dbtn dbtn--ghost" hover-class="k-press-s" @click="diaryDraft = null"><text>不要了</text></view>
          <view class="dbtn dbtn--main" hover-class="k-press-s" @click="saveDraftDiary"><text>保存</text></view>
        </view>
      </view>
      <text v-if="!diaryDraft && !media.entries.length" class="trip-hint k-mt10">还没有生活碎片，点上面「添加照片」或「添加视频」。</text>
      <view v-for="(entry, entryIdx) in diaryCards" :key="entry.diaryId" class="dcard">
        <view class="dcard__top">
          <view class="dcard__thumb" hover-class="k-press-s" @click="previewDiary(entry)">
            <image v-if="entry.cover" class="mcard__img" :src="mediaThumb(entry.cover)" mode="aspectFill" />
            <view v-else class="mcard__img dcard__ph" />
            <view v-if="entry.type === 'video'" class="mcard__play mcard__play--sm"><k-icon name="play" :size="12" color="white" fill /></view>
          </view>
          <view class="k-flex1 dcard__fields">
            <text v-if="entry.hidden" class="dcard__hidden">已被平台隐藏</text>
            <input :value="entry.caption" class="dcard__input" maxlength="32" placeholder="写一句话（可以不写）" placeholder-class="d-ph" @input="editDiaryCaption(entry, $event)" />
            <view class="dcard__date" hover-class="k-press" @click="editDiaryDate(entry)"><k-icon name="calendar" :size="16" color="muted" :stroke="1.8" /><text>拍摄日期 {{ entry.shotDate || '未填' }}</text><k-icon name="chevron-right" :size="14" color="muted" :stroke="1.8" /></view>
          </view>
        </view>
        <view class="dcard__btns">
          <view class="dbtn" :class="{ 'dbtn--off': entryIdx === 0 }" hover-class="k-press-s" @click="moveDiary(entry, entryIdx, -1)"><k-icon name="arrow-up" :size="16" color="ink" :stroke="2" /><text>上移</text></view>
          <view class="dbtn" :class="{ 'dbtn--off': entryIdx === diaryCards.length - 1 }" hover-class="k-press-s" @click="moveDiary(entry, entryIdx, 1)"><k-icon name="arrow-down" :size="16" color="ink" :stroke="2" /><text>下移</text></view>
          <view class="dbtn dbtn--del" hover-class="k-press-s" @click="deleteDiary(entry)"><k-icon name="trash-2" :size="16" color="muted" :stroke="2" /><text>删除</text></view>
          <view v-if="entry.dirty" class="dbtn dbtn--main" hover-class="k-press-s" @click="saveDiary(entry)"><text>保存</text></view>
        </view>
      </view>
      <k-tabbar mode="staff" active="work" />
    </view>

    <!-- 4 Vlog 上传与审核（2026-10-31 R7）：原来的五个圈是假的（永远第 1 个亮），换成一句话；视频本身发在抖音 / 小红书 / 视频号，这里提交链接 -->
    <view v-else class="fc-form vlog-body">
      <view class="fc-steps"><text class="fc-steps__t">第 1 步：视频和内容</text><text>下一步确认授权并提交</text></view>
      <view class="fc-block">
        <view class="fc-field">
          <view class="fc-label"><text class="fc-label__t">上传视频</text></view>
          <view class="fc-photos"><view class="fc-photo" hover-class="k-press-s" @click="previewVideo"><template v-if="vlog.cover"><image class="fc-photo__img" :src="absUrl(vlog.cover)" mode="aspectFill" /><view class="fc-photo__play"><k-icon name="play" :size="16" color="white" fill /></view></template><view v-else class="fc-photo__add"><k-icon name="play" :size="24" color="ink2" :stroke="1.8" /><text>预览</text></view></view><view class="fc-photo" hover-class="k-press-s" @click="addMore"><view class="fc-photo__add"><k-icon name="plus" :size="24" color="ink2" :stroke="1.8" /><text>继续添加</text></view></view></view>
          <text class="fc-note">{{ vlogTip }}</text>
        </view>
        <view class="fc-field">
          <view class="fc-label"><text class="fc-label__t">封面图</text><text class="fc-req">必填</text></view>
          <view class="fc-cover-row"><view class="fc-cover vlog-cover" hover-class="k-press-s" @click="pickCover"><image v-if="vlog.cover" class="fc-photo__img" :src="absUrl(vlog.cover)" mode="aspectFill" /><view v-else class="fc-photo__add"><k-icon name="plus" :size="24" color="ink2" :stroke="1.8" /><text>上传</text></view></view><text class="fc-note">{{ vlog.cover ? '已上传，点图片可以更换' : '建议竖版 3:4' }}</text></view>
        </view>
      </view>
      <view class="fc-block">
        <view class="fc-field">
          <view class="fc-label"><text class="fc-label__t">来源平台</text></view>
          <view class="fc-seg fc-seg--3"><view v-for="o in ['抖音', '小红书', '视频号']" :key="o" class="fc-seg__item" :class="{ on: vlog.platform === o }" hover-class="k-press" @click="vlog.platform = o"><text>{{ o }}</text></view></view>
        </view>
        <view class="fc-field">
          <view class="fc-label"><text class="fc-label__t">视频链接</text><text class="fc-req">必填</text><view class="fc-act" hover-class="k-press" @click="copyLink"><text>复制链接</text></view></view>
          <input v-model="vlog.link" class="fc-input" maxlength="500" placeholder="粘贴视频链接" placeholder-class="fc-ph" />
        </view>
        <view class="fc-field">
          <view class="fc-label"><text class="fc-label__t">内容标题</text><text class="fc-req">必填</text><text class="fc-count">{{ vlog.title.length }}/30</text></view>
          <input v-model="vlog.title" class="fc-input" :maxlength="30" placeholder="请输入内容标题" placeholder-class="fc-ph" />
        </view>
      </view>
      <text class="fc-footnote">建议每周至少发布 2 条优质 Vlog，保持活跃度有助于提升曝光与转化。</text>
      <view class="fc-bar"><view class="fc-bar__btns"><fc-kefu /><view class="fc-btn fc-btn--ghost" hover-class="k-press-s" @click="saveVlogDraft"><text>保存草稿</text></view><view class="fc-btn" hover-class="k-press-s" @click="submitVlog()"><text>下一步</text></view></view></view>
    </view>
    <!-- 房态日期 / 资质有效期 / 群码有效期：之前要手敲 yyyy-MM-dd，改成日历 -->
    <k-date-picker v-if="datePick" :title="datePick.title" :value="datePick.value || ''" :min-date="datePick.min || ''" :max-date="datePick.max || ''" :allow-empty="!!datePick.allowEmpty" @cancel="closeDatePick(null)" @confirm="closeDatePick" />
  </view>
</template>

<script setup>
// ---------------------------------------------------------------------------
// 房源管理（员工端）接入情况：
//   s=1 房源列表：apiStaffStays（房源数、近 30 天入住率、今日订单都是真实统计）；卡片下面一整行五个按钮：编辑房源、房型管理（2026-11-03
//       新的二级页 room-types.vue）、房态（同一个二级页的第三屏 ?s=3，14 天小表）、提交审核 / 下架 / 审核中（按状态变）、更多；
//       "更多"只剩视频与生活碎片、住客群码、资质、Vlog（2026-11-03 主人：简化——商圈 / 位置描述 / 封面并进编辑表单，地图位置表单里本来就有）。
//       从别的页回来（房型管理、房态、Vlog 等）onShow 重新拉当前这一屏的数据
//   s=2 新建 / 编辑：只存草稿，上线必须经平台审核；来源类型（直营 / 加盟 / 代运营 / 合作）由平台按门店签约设置，这里只读
//   s=3 资质：营业执照、负责人身份证（必填），消防安全检查合格证、食品安全许可证、特种行业许可证（选填，2026-11-03 消防改选填、加食品安全）；文件私有存储，查看用 5 分钟有效的签名链接
//   s=4 Vlog：视频本身发布在抖音 / 小红书 / 视频号，这里提交链接引用，门店审核通过后在房源详情展示
// ---------------------------------------------------------------------------
import { ref, reactive, computed, watch } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useScreen, go, back, toast } from '@/common/screen.js'
import {
  apiStaffStays, apiStaffStay, apiStaffCreateStay, apiStaffEditStay, apiStaffSubmitStay, apiStaffOfflineStay, apiStaffStayGroup,
  apiStaffCreateVlog, apiStaffQualExpire
} from '@/common/api.js'
import { experience, ensureSession, hasStaffAccess, currentStaffStoreId, selectStaffStore, merchantStaff } from '@/common/experience.js'
import { errText, confirm, prompt, sheet, pickPaged, copy, isYmd, todayCn, shiftDate } from '@/common/ui.js'
import { uploadTo, chooseImage, chooseDoc, absUrl, openFile } from '@/common/upload.js'
import R from '@/common/routes.js'
import { coordinates, chooseStayLocation } from '@/common/stay-location.js'
// 操作条上的客服方块、滚到报错：staff 分包里的，组件要显式引入，不走全局 easycom（2026-11-03 设施改成直接点选，不再用底部弹层 fc-sheet）
import FcKefu from './components/fc-kefu.vue'
import MerchantAgreement from './components/merchant-agreement.vue'
const stayAgreement = ref(null)
import { scrollToField } from './fc-page.js'
import { staySubmissionMissing, weekPriceText } from './stay-submission.js'
// 编辑表单的选项（2026-10-17 R2：所在区县、设施字典）只有这一页用，直接在员工分包里调，不往主包的 common/api.js 里加
import { get, put, post, del } from '@/common/request.js'
// previewVideo 这个名字本页 Vlog 屏已经用了（复制外链预览），这里起个别名
import { VIDEO_MAX_SECONDS, VIDEO_MAX_MB, INTRO_MAX_SECONDS, INTRO_MAX_MB, chooseAndUploadVideo, uploadVideoParts, previewVideo as playVideoFull } from './stay-video.js'
const apiStaffStayFormOptions = (q) => get('/app/staff/stay/form-options', q)

// 审核结果通知（?stayId=）直接打开资质与审核屏：那一屏的返回回到消息，而不是本页的房源列表
let landing = 1
// 「下一步」从基本信息进资质屏时，返回回基本信息（之前直接回列表）
let backTo = 1
const s = useScreen(5, {
  onLoad: async (q) => {
    if (q?.action === 'groupQr' && Number(q.stayId) && Number(q.storeId)) {
      try {
        await ensureSession()
        if (String(q.storeId) !== String(currentStaffStoreId())) await selectStaffStore(q.storeId)
        await loadList()
        if (await sheet(['更新住客群码']) === 0) {
          await updateGroupQr(Number(q.stayId))
          await loadList()
        }
      } catch (e) { toast(errText(e, '门店或房源已变更')) }
      return
    }
    const id = Number(q?.stayId) || 0
    loadList()
    // ?s=5&stayId= 直接打开「视频与生活碎片」（2026-10-17 R3），其余带 stayId 的照旧打开资质与审核屏
    if (id && Number(q?.s) === 5) openMedia(id).then(() => { if (s.value === 5) landing = 5 })
    else if (id) openStay(id, 3).then(() => { if (s.value === 3) landing = 3 })
  }
})
watch(s, (v) => {
  if (v === 1) { landing = 1; loadList() }
  if (v === 4 && !vlog.link && !vlog.title) {
    try { Object.assign(vlog, uni.getStorageSync('kangaroo:vlog-draft') || {}) } catch (e) { /* 草稿只存本机 */ }
  }
})
const titles = ['房源管理', '新增 / 编辑房源', '资质上传与审核', 'Vlog 上传与审核', '视频与生活碎片']
// 页内日历：await pickDate({ title, value, min, max, allowEmpty }) → 'yyyy-MM-dd'；选「不限日期」得 ''；取消得 null
const datePick = ref(null)
const pickDate = (opts) => new Promise((resolve) => {
  if (datePick.value) datePick.value.resolve(null)
  datePick.value = { ...opts, resolve }
})
const closeDatePick = (v) => {
  const p = datePick.value
  datePick.value = null
  if (p) p.resolve(v == null ? null : v)
}
// 保存 / 提交审核 / 提交 Vlog：网络慢时连点会重复提交（重复建房源）
let busy = false

// ---------------- s=1 列表 ----------------
const data = ref({ rows: [], stats: {}, tabs: {} })
const TAB_KEYS = [['全部', 'all', ''], ['营业中', 'online', 'online'], ['待审核', 'pending', 'pending'], ['已下架', 'offline', 'offline']]
const tabIdx = ref(0)
const tabs = computed(() => TAB_KEYS.map(t => `${t[0]} ${(data.value.tabs || {})[t[1]] || 0}`))
const tab = computed(() => tabs.value[tabIdx.value])
const setTab = (label) => {
  tabIdx.value = Math.max(0, tabs.value.indexOf(label))
  loadList()
}
const keyword = ref('')
// 运营类型按服务端 kg_store.op_type（列表接口的 operateModeLabel）显示；取到之前显示「运营类型」，不再先假定是直营
const opLabel = ref('运营类型')
const listLoaded = ref(false)
const TONE = { online: 'green', pending: 'ochre', rejected: 'red', draft: 'neutral', offline: 'neutral' }
const rooms = computed(() => (data.value.rows || []).map((r, i) => ({
  stayId: r.stayId, img: r.cover ? absUrl(r.cover) : '/static/media/cover-empty.png', name: r.stayName, status: r.statusLabel,
  rawStatus: r.status, tone: TONE[r.status] || 'neutral', addr: r.address || r.areaDesc || r.area || '未填写地址',
  rate: r.status === 'online' ? r.occupancy + '%' : '', orders: String(r.todayOrders || 0),
  note: r.status === 'rejected' ? '驳回原因  ' + (r.auditReason || '') : (r.status === 'offline' ? '下架原因  ' + (r.auditReason || '') : (r.status === 'pending' ? '已提交，等待平台审核' : '草稿，补全后提交审核')),
  // 2026-11-03：卡片第四个按钮按状态变（原来「提交审核」「下架」藏在「更多」菜单里）
  actionLabel: r.status === 'online' ? '下架' : (r.status === 'pending' ? '审核中' : '提交审核'),
  actionIcon: r.status === 'online' ? 'power' : (r.status === 'pending' ? 'hourglass' : 'send'),
  actions: true
})))
// 列表为空时没有单独的空态块（加节点会动设计稿结构），就在底部「新增房源」按钮上说明
const newStayLabel = computed(() => {
  if (!listLoaded.value || rooms.value.length) return '新增房源'
  return keyword.value || tabIdx.value ? '没有符合条件的房源 · 新增房源' : '暂无房源 · 新增第一个房源'
})
async function loadList() {
  await ensureSession()
  if (!hasStaffAccess.value) return
  try {
    data.value = (await apiStaffStays({ storeId: currentStaffStoreId(), status: TAB_KEYS[tabIdx.value][2] || undefined, keyword: keyword.value || undefined })).data || data.value
    if (data.value.operateModeLabel) opLabel.value = data.value.operateModeLabel
    listLoaded.value = true
  } catch (e) {
    toast(errText(e, '房源加载失败'))
  }
}
const sourceTip = () => toast(data.value.operateModeLabel ? `本店运营类型：${data.value.operateModeLabel}（由平台按签约设置）` : '运营类型还没取到，请稍后再试')
async function pickStatus() {
  const i = await sheet(TAB_KEYS.map(t => t[0]))
  if (i >= 0) { tabIdx.value = i; loadList() }
}
async function askKeyword() {
  const v = await prompt('搜索房源', { value: keyword.value, placeholder: '房源名 / 商圈' })
  if (v === null) return
  keyword.value = v
  loadList()
}
const statusText = computed(() => (tabIdx.value ? TAB_KEYS[tabIdx.value][0] : '全部状态'))
async function moreFilter() {
  const i = await sheet(['按状态筛选', '按房源名 / 商圈搜索', '清除筛选'])
  if (i === 0) pickStatus()
  if (i === 1) askKeyword()
  if (i === 2) { tabIdx.value = 0; keyword.value = ''; loadList() }
}

// 房态（2026-11-03 主人：简化房态改价）：原来这里连着弹 5 个系统框（选房型 → 选操作 → 开始日 → 结束日 → 填数），「查看本月房态」还是一段纯文字弹窗；
// 现在直接跳房型页的第三屏（room-types.vue?s=3）：选房型后 14 天一格的小表，点一天出底部面板改价 / 改库存 / 关房 / 开房，整段改价两行日期 + 一个框 + 应用
const openCalendar = (r) => go('/pages/staff/room-types?stayId=' + r.stayId + '&s=3')

// 房型管理（2026-11-03 主人：「新增在一个页，现在操作太繁琐了很多都是老人…增加个单独的二级页」「填写7天的价格…不要弹窗」）：
// 原来在「更多 → 房型管理」里连着弹 5 个系统框，现在进单独的二级页 room-types.vue（房型列表、新增、修改、停用、7 天价格都在那一页）；
// 回来时本页 onShow 会刷新，不用退出去再进来
const openRoomTypes = (r, flow = false) => go('/pages/staff/room-types?stayId=' + r.stayId + (flow ? '&flow=listing' : ''))

// 提交审核 / 下架（2026-11-03 主人：简化「更多」）：按状态做成卡片上的第四个按钮，原来藏在「更多」菜单第二项。
// 草稿 / 驳回 / 已下架 →「提交审核」进资质与审核屏；审核中 →「审核中」进去看进度；上线中 →「下架」在卡片下面展开一个输入框写原因（原来是系统输入框）
const offlineBox = ref(null)
function statusAction(r) {
  if (r.rawStatus === 'online') { offlineBox.value = { stayId: r.stayId, reason: '' }; return }
  return openStay(r.stayId, 3)
}
async function confirmOffline() {
  const box = offlineBox.value
  if (!box) return
  const why = String(box.reason || '').replace(/\s+/g, ' ').trim()
  if (!why) return toast('请写一句下架原因')
  if (busy) return
  busy = true
  try {
    const res = await apiStaffOfflineStay(box.stayId, why)
    toast(res.msg || '已下架')
    offlineBox.value = null
    loadList()
  } catch (e) {
    toast(errText(e, '下架失败，请重试'))
  } finally {
    busy = false
  }
}

async function updateGroupQr(stayId) {
  const path = await chooseImage()
  if (!path) return
  const up = await uploadTo('/app/upload/image', path)
  // 微信群码 7 天有效
  const exp = await pickDate({ title: '群码有效期至', value: shiftDate(todayCn(), 7), min: todayCn(), max: shiftDate(todayCn(), 7) })
  await apiStaffStayGroup(stayId, { qr: up.data.url, expire: exp || '', name: '' })
  toast('住客群码已更新')
}

async function moreActions(r) {
  // 2026-10-31：同事找不到换视频的入口，「视频与生活碎片」固定放第一项。下面按名字分派，不按序号，调顺序不影响
  // 2026-11-03 主人：简化「更多」——「提交审核 / 下架」做成卡片上的主按钮，「编辑商圈与位置」「更换封面」并进「编辑房源」表单，
  // 「设置地图位置」表单里本来就有（地图选点）；这里只剩 4 项不常用的，一个系统菜单放得下，不用翻页（原来最多 8 项要翻页）
  const acts = ['视频与生活碎片', '住客群码', '资质上传与审核', '上传 Vlog']
  const i = await sheet(acts)
  if (i < 0) return
  const a = acts[i]
  try {
    if (a === '资质上传与审核') {
      return openStay(r.stayId, 3)
    } else if (a === '视频与生活碎片') {
      return openMedia(r.stayId)
    } else if (a === '住客群码') {
      await updateGroupQr(r.stayId)
    } else {
      return openStay(r.stayId, 4)
    }
    loadList()
  } catch (e) {
    toast(errText(e, '操作失败'))
  }
}

// ---------------- s=2 新建 / 编辑 ----------------
const editingId = ref(null)
const stayInfo = ref({})
// 2026-10-17 R2：所在区县、主理人年龄 / 籍贯 / 擅长、出行参考四段、配套设施（字典代码）、可做饭
const EMPTY_R2 = () => ({ district: '', hostAge: '', hostHometown: '', hostSkills: '', travelPros: '', travelCons: '', travelAirport: '', travelRail: '', facilities: [], cookable: false })
// 2026-11-03 主人：简化「更多」——商圈、位置描述、封面并进表单（原来在「更多」里各弹各的系统框）
const EMPTY_EXTRA = () => ({ area: '', areaDesc: '', cover: '' })
const form = reactive({ name: '', addr: '', type: '', desc: '', tags: [], hostName: '', latitude: null, longitude: null, ...EMPTY_R2(), ...EMPTY_EXTRA() })
// 字数上限和服务端（KgStayStaffService.MAX_LEN）一致
const HOST_FIELDS = [
  { key: 'hostAge', label: '年龄', max: 16, placeholder: '如：32岁 / 90后' },
  { key: 'hostHometown', label: '籍贯', max: 32, placeholder: '如：四川成都' },
  { key: 'hostSkills', label: '擅长', max: 128, placeholder: '如：做饭、徒步向导、手冲咖啡' }
]
const TRAVEL_FIELDS = [
  { key: 'travelPros', label: '优点', max: 255, placeholder: '如：步行 5 分钟到古城，周边吃饭方便' },
  { key: 'travelCons', label: '缺点', max: 255, placeholder: '如：巷子窄，车开不到门口，要走 200 米' },
  { key: 'travelAirport', label: '机场怎么到', max: 255, placeholder: '如：机场打车约 40 分钟，80 元左右' },
  { key: 'travelRail', label: '高铁怎么到', max: 255, placeholder: '如：高铁站坐 4 路公交到古城口，约 30 分钟' }
]
// 2026-11-03 主人：简化——主理人三项、出行参考四段不再点开弹系统输入框（editField 删掉了），就是页面里的输入框；
// 出行参考四段较长，和房源简介一样只在点开时才放真 textarea（editingField = 正在编辑的字段名），离开这一屏收起
const editingField = ref('')
// 封面并进表单：选一张马上传好，存在 form.cover 里随表单一起保存；审核中 / 上线中的封面要先下架（和资质屏那条规则一样）
async function pickFormCover() {
  if (coverUploading.value) return toast('正在上传，请稍候')
  if (editingId.value && ['online', 'pending'].includes((stayInfo.value || {}).status)) return toast('审核中或已上线的封面要先下架才能换')
  coverUploading.value = true
  try {
    const path = await chooseImage()
    if (!path) return
    const up = await uploadTo('/app/upload/image', path)
    form.cover = up.data.url
  } catch (e) {
    toast(errText(e, '封面上传失败，请重试'))
  } finally {
    coverUploading.value = false
  }
}
// 表单选项：这座城市的区县、设施字典（服务端按房源 / 门店所在城市给）；取不到时区县只能手填，设施只剩「可做饭」
const formOpts = ref({ districts: [], facilities: [] })
async function loadFormOptions(stayId) {
  const originStore = currentStaffStoreId()
  try {
    const result = (await apiStaffStayFormOptions(stayId ? { stayId } : { storeId: originStore })).data
    if (originStore !== currentStaffStoreId()) return
    formOpts.value = result || { districts: [], facilities: [] }
  } catch (e) {
    if (originStore !== currentStaffStoreId()) return
    formOpts.value = { districts: [], facilities: [] }
  }
}
const facOptions = computed(() => formOpts.value.facilities || [])
function toggleFacility(code) {
  const i = form.facilities.indexOf(code)
  if (i >= 0) form.facilities.splice(i, 1)
  else form.facilities.push(code)
}
// 设施点选（2026-11-03 主人：「增加一个对勾，你点一下对勾就选中，能清楚的看到我选了那个」）：选项是字典 + 「可做饭」，直接摊在表单里，点一下选中 / 取消。
// 字典里已经没有的老代码原来就看不到也不会被动，这里同样不列、不改，保存时原样带上
const COOK_KEY = '__cookable'
const facChoices = computed(() => [...facOptions.value.map(o => ({ label: o.label, value: o.value })), { label: '可做饭', value: COOK_KEY }])
const facKnown = (code) => facOptions.value.some(o => o.value === code)
const facPicked = (value) => (value === COOK_KEY ? !!form.cookable : form.facilities.includes(value))
function tapFacility(value) {
  if (value === COOK_KEY) form.cookable = !form.cookable
  else toggleFacility(value)
}
// 标题右边「已选 N 项」
const facNames = computed(() => [...form.facilities.filter(facKnown).map(c => facOptions.value.find(o => o.value === c).label), ...(form.cookable ? ['可做饭'] : [])])
async function pickDistrict() {
  const list = formOpts.value.districts || []
  const items = list.concat(['手动填写', '不填（清空）'])
  const i = await pickPaged(items, '所在区县')
  if (i < 0) return
  if (i < list.length) { form.district = list[i]; return }
  if (i === list.length + 1) { form.district = ''; return }
  const v = await prompt('所在区县', { value: form.district, placeholder: '如：古城区、道外区' })
  if (v === null) return
  const t = v.replace(/\s+/g, ' ').trim()
  if (t.length > 32) return toast('所在区县最多 32 个字')
  form.district = t
}
const locationBusy = ref(false)
// 房源简介只在点开时才放真 textarea；离开这一屏收起，回来不会自己弹键盘
const editingDesc = ref(false)
watch(s, (v) => { if (v !== 2) { editingDesc.value = false; editingField.value = '' } })
const DESC_HINT = '写写小院的位置、风格和住客能得到什么'
// 更多选填：标签 + 主理人三项 + 出行参考四段。新建默认收起；打开时里面已有内容就默认展开，不让人以为东西丢了
const moreOpen = ref(false)
const moreFilled = computed(() => (form.tags.length ? 1 : 0) + [...HOST_FIELDS, ...TRAVEL_FIELDS].filter(f => form[f.key]).length)
// 就地提示：点过保存才标红（和招募表同一个做法）。规则就是 saveStay 开头那两条，没改
const tried = ref(false)
const rerr = computed(() => {
  const e = {}
  if (!tried.value) return e
  if (!form.name.trim()) e.name = '请填写房源名称'
  if (!form.addr.trim()) e.addr = '请填写房源地址'
  return e
})
const formPoint = computed(() => coordinates(form))
let locationButtonLabel = '地图选点'
// #ifdef H5
locationButtonLabel = '填写地图坐标'
// #endif
const addressChanged = () => { form.latitude = null; form.longitude = null }
async function pickFormLocation() {
  if (locationBusy.value) return
  locationBusy.value = true
  try {
    const point = await chooseStayLocation({ ...form, address: form.addr })
    // 2026-10-18 主人真机：上线中的房源在这里选点，地址被换成地图给的地址（地址算核心内容）→ 整张表要求先下架。
    // 上线中只记位置、不动地址文字；草稿 / 下架的照旧顺手带上地图地址
    const online = stayInfo.value && stayInfo.value.status === 'online' && editingId.value
    if (point) Object.assign(form, { latitude: point.latitude, longitude: point.longitude, addr: online ? form.addr : (point.address || form.addr) })
  } finally { locationBusy.value = false }
}
// 2026-11-03：「更多 → 设置地图位置」删掉了（表单里的「地图选点」就是它），setStayLocation 随之去掉
async function newStay() {
  const originStore = currentStaffStoreId()
  // 新房源建在当前门店：运营类型跟当前门店（列表接口返回的），列表还没取到就先取一次
  if (!data.value.operateModeLabel) await loadList()
  if (originStore !== currentStaffStoreId()) return
  editingId.value = null
  stayInfo.value = {}
  submissionError.value = ''
  Object.assign(form, { name: '', addr: '', type: data.value.operateModeLabel || '', desc: '', tags: [], hostName: '', latitude: null, longitude: null, ...EMPTY_R2(), ...EMPTY_EXTRA() })
  moreOpen.value = false
  tried.value = false
  await loadFormOptions(0)
  if (originStore !== currentStaffStoreId()) return
  const defaults = formOpts.value.storeDefaults || {}
  Object.assign(form, { name: defaults.storeName || '', addr: defaults.address || '', latitude: defaults.latitude ?? null, longitude: defaults.longitude ?? null, cover: defaults.cover || '' })
  s.value = 2
}
async function openStay(stayId, screen) {
  try {
    const st = (await apiStaffStay(stayId)).data || {}
    submissionError.value = ''
    stayInfo.value = st
    editingId.value = st.stayId
    opLabel.value = st.operateModeLabel || opLabel.value
    Object.assign(form, {
      name: st.stayName || '', addr: st.address || '', type: st.operateModeLabel || '', desc: st.hostStory || '',
      tags: String(st.tags || '').split(',').filter(Boolean), hostName: st.hostName || '', latitude: st.latitude, longitude: st.longitude,
      district: st.district || '', hostAge: st.hostAge || '', hostHometown: st.hostHometown || '', hostSkills: st.hostSkills || '',
      travelPros: st.travelPros || '', travelCons: st.travelCons || '', travelAirport: st.travelAirport || '', travelRail: st.travelRail || '',
      facilities: String(st.facilities || '').split(',').map(x => x.trim()).filter(Boolean), cookable: String(st.cookable) === '1',
      area: st.area || '', areaDesc: st.areaDesc || '', cover: st.cover || ''
    })
    moreOpen.value = moreFilled.value > 0
    tried.value = false
    if (screen === 2) loadFormOptions(st.stayId)
    s.value = screen
  } catch (e) {
    toast(errText(e, '房源加载失败'))
  }
}
const openEdit = (r) => openStay(r.stayId, 2)
// 上线中 / 审核中：哪些直接改、哪些要先下架（新建、草稿、驳回、已下架的什么都能改，不提示）
const editableTip = computed(() => {
  const st = stayInfo.value || {}
  if (!editingId.value || !['online', 'pending'].includes(st.status)) return ''
  const direct = st.directEditable || '所在区县、地图位置、主理人信息、出行参考、配套设施、视频与生活碎片'
  return (st.status === 'online' ? '房源已上线：' : '房源审核中：') + direct + '可以直接改，保存就生效；名称、地址、简介、标签等其他内容要先下架再改'
})
const hostPhone = computed(() => {
  const p = String(experience.account?.phone || '')
  return p ? '手机号 ' + p.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2') : '未绑定手机号'
})
// 主理人头像之前写死 /static/media/rooms-host.jpg（设计稿里某个真人的照片），每个房源的主理人都显示成这个人；
// 房源数据里没有主理人头像，改用品牌默认头像（袋鼠线稿），不冒充任何人
// 来源类型 2026-11-03 起有四种：直营 / 加盟 / 代运营 / 合作（V70），按门店签约在后台「门店管理」里设，这里只读
const typeTip = () => toast('来源类型（直营 / 加盟 / 代运营 / 合作）由平台按门店签约设置')
async function editHost() {
  const v = await prompt('主理人对外称呼', { value: form.hostName, placeholder: '显示在房源详情页，如：小院阿东' })
  if (v !== null) form.hostName = v.slice(0, 32)
}
const removeTag = (t) => { form.tags = form.tags.filter(x => x !== t) }
async function addTag() {
  if (form.tags.length >= 6) return toast('最多 6 个标签')
  const v = await prompt('添加标签', { placeholder: '不超过 6 个字' })
  if (v && !form.tags.includes(v)) form.tags.push(v.slice(0, 6))
}
async function saveStay(nextStep) {
  tried.value = true
  if (!form.name.trim()) { scrollToField('#rf-name'); return toast('请填写房源名称') }
  if (!form.addr.trim()) { scrollToField('#rf-addr'); return toast('请填写房源地址') }
  const payload = { stayName: form.name.trim(), address: form.addr.trim(), hostStory: form.desc, tags: form.tags.join(','), hostName: form.hostName, latitude: form.latitude, longitude: form.longitude,
    district: form.district, hostAge: form.hostAge, hostHometown: form.hostHometown, hostSkills: form.hostSkills,
    travelPros: form.travelPros, travelCons: form.travelCons, travelAirport: form.travelAirport, travelRail: form.travelRail,
    facilities: form.facilities.join(','), cookable: form.cookable ? '1' : '0',
    area: form.area, areaDesc: form.areaDesc, cover: form.cover }
  if (busy) return
  busy = true
  try {
    const res = editingId.value ? await apiStaffEditStay(editingId.value, payload) : await apiStaffCreateStay(currentStaffStoreId(), payload)
    stayInfo.value = res.data || stayInfo.value
    editingId.value = (res.data || {}).stayId || editingId.value
    toast(['draft', 'rejected', 'offline'].includes(stayInfo.value.status) ? '房源信息已保存，尚未提交审核' : '房源信息已保存')
    if (nextStep) { backTo = 2; s.value = 3; if (submissionEditable.value) openRoomTypes({stayId: editingId.value}, true) }
  } catch (e) {
    toast(errText(e, '保存失败'))
  } finally {
    busy = false
  }
}

// ---------------- s=3 资质 ----------------
const steps3 = ['基本信息', '房型与资质', '提交审核', '审核结果']
const submissionEditable = computed(() => !!stayInfo.value.stayId && ['draft', 'rejected', 'offline'].includes(stayInfo.value.status))
const submissionMissing = computed(() => staySubmissionMissing(stayInfo.value))
const submissionError = ref('')
const coverUploading = ref(false)
const submissionWorking = () => busy || coverUploading.value || qualificationUploading.value
async function editSubmissionBasics() {
  if (submissionWorking()) return toast('正在保存，请稍候')
  await openStay(editingId.value, 2)
}
async function uploadSubmissionCover() {
  if (!submissionEditable.value) return toast('审核中或已上线的封面不能直接修改')
  if (submissionWorking()) return toast('正在保存，请稍候')
  coverUploading.value = true
  try {
    const path = await chooseImage()
    if (!path) return
    const up = await uploadTo('/app/upload/image', path)
    const res = await apiStaffEditStay(editingId.value, { cover: up.data.url })
    stayInfo.value = res.data
    submissionError.value = ''
    toast('封面已保存')
  } catch (e) { submissionError.value = errText(e, '封面保存失败，请重试') }
  finally { coverUploading.value = false }
}
const docs = computed(() => (stayInfo.value.quals || []).map(q => ({
  type: q.type, title: q.title, required: q.required, hint: q.required ? '' : '（如有）',
  file: q.uploaded ? q.file : '未上传', size: q.uploaded ? q.size + (q.expired ? ' · 已过期' : '') : (q.required ? '必填' : '选填'), uploaded: q.uploaded,
  state: q.uploaded ? (q.expired ? '已过期' : '已上传') : '未上传', expired: !!(q.uploaded && q.expired),
  expire: q.expire || (q.uploaded ? '长期有效' : '未填写'), url: q.url, isPdf: q.isPdf
})))
const qualificationUploading = ref(false)
let qualificationFileLabel = '从微信聊天选图片或 PDF'
// #ifdef H5
qualificationFileLabel = '从本机选图片或 PDF'
// #endif
async function uploadDoc(d, selectedSource = null) {
  if (!editingId.value) return toast('请先保存房源基本信息')
  if (submissionWorking()) return toast('正在保存，请稍候')
  qualificationUploading.value = true
  let loading = false
  try {
    const source = selectedSource === null
      ? await sheet(['从相册选择', '拍照上传', qualificationFileLabel]) : selectedSource
    if (source < 0) return
    const path = await chooseDoc(['album', 'camera', 'file'][source])
    if (!path) return
    // 长期有效的证件选「不限日期」
    const exp = await pickDate({ title: `${d.title} 有效期至`, value: '', min: todayCn(), allowEmpty: true })
    if (exp === null) return
    uni.showLoading({ title: '上传中' })
    loading = true
    const res = await uploadTo(`/app/staff/stay/stays/${editingId.value}/qualifications`, path, { type: d.type, expire: exp || '' })
    stayInfo.value = { ...stayInfo.value, quals: res.data }
    toast('已上传')
  } catch (e) {
    toast(errText(e, '上传失败'))
  } finally {
    if (loading) uni.hideLoading()
    qualificationUploading.value = false
  }
}
async function tapDoc(d) {
  if (!d.uploaded) return uploadDoc(d)
  const i = await sheet(['查看文件', '从相册重新上传', '拍照重新上传', qualificationFileLabel])
  if (i === 0) openFile(d.url, d.isPdf)
  if (i > 0) uploadDoc(d, i - 1)
}
async function editExpire(d) {
  if (submissionWorking()) return toast('正在保存，请稍候')
  if (!d.uploaded) return toast('请先上传文件')
  const v = await pickDate({ title: `${d.title} 有效期至`, value: isYmd(d.expire) ? d.expire : '' })
  if (!v) return
  try {
    const res = await apiStaffQualExpire(editingId.value, d.type, v)
    stayInfo.value = { ...stayInfo.value, quals: res.data }
  } catch (e) {
    toast(errText(e, '保存失败'))
  }
}
const timeline = computed(() => {
  const st = stayInfo.value.status
  const submitted = ['pending', 'online', 'rejected'].includes(st) || (!!stayInfo.value.submitTime && st !== 'draft')
  return [
    { title: '提交审核', time: stayInfo.value.submitTime ? String(stayInfo.value.submitTime).slice(0, 16) : (submitted ? '—' : '未提交'), done: submitted },
    { title: '平台审核中', time: submitted ? String(stayInfo.value.submitTime).slice(0, 16) : '—', done: ['pending', 'online', 'rejected'].includes(st) },
    { title: '审核结果', time: ['online', 'rejected'].includes(st) && stayInfo.value.auditTime ? String(stayInfo.value.auditTime).slice(0, 16) : '待确定', done: ['online', 'rejected'].includes(st) }
  ]
})
// 审核结果卡：驳回时展示原因 + 重新提交；草稿 / 下架时提示提交；审核中只展示状态；已上线展示通过时间
const rejectBox = computed(() => {
  const st = stayInfo.value
  const t = (v) => (v ? String(v).slice(0, 16) : '')
  if (!st.stayId) return { title: '待提交审核', time: '', desc: '请先在上一步保存房源基本信息，再上传资质。', btn: '' }
  if (st.status === 'rejected') return { title: '审核驳回', time: t(st.auditTime), desc: '驳回原因：' + (st.auditReason || '未填写'), btn: '重新提交', alert: true }
  if (st.status === 'pending') return { title: '平台审核中', time: t(st.submitTime), desc: '审核期间不能修改内容，结果会通过消息通知你。', btn: '' }
  if (st.status === 'online') return { title: '审核通过', time: t(st.auditTime), desc: '房源已上线。所在区县、地图位置、主理人信息、出行参考、配套设施、视频与生活碎片可以直接改；名称、地址、简介等其他内容要先下架，改完重新提交审核。', btn: '' }
  if (st.status === 'offline') return { title: '已下架', time: '', desc: '下架原因：' + (st.auditReason || '未填写') + '。整改后可重新提交审核。', btn: '重新提交' }
  return { title: '待提交审核', time: '', desc: '请补齐房源封面、至少一个可用房型和必填资质，再统一提交平台审核。审核通过后住客才能预订。', btn: '提交审核' }
})
async function resubmit() {
  if (!editingId.value) return
  if (submissionWorking()) return toast('资料正在保存，请稍候')
  submissionError.value = ''
  if (submissionMissing.value.length) {
    submissionError.value = '请先补齐：' + submissionMissing.value.join('、')
    toast('资料未齐，请按页面提示补充')
    return
  }
  if (!(await confirm('提交审核', '确认资料无误并提交平台审核？审核期间不能修改内容。')) || busy) return
  busy = true
  try {
    if (merchantStaff.value && !await stayAgreement.value?.confirm()) return
    const res = await apiStaffSubmitStay(editingId.value)
    toast(res.msg || '已提交')
    await openStay(editingId.value, 3)
  } catch (e) {
    submissionError.value = errText(e, '提交失败，请重试')
    toast(submissionError.value)
  } finally {
    busy = false
  }
}

// ---------------- s=4 Vlog ----------------
const PLATFORM = { 抖音: 'douyin', 小红书: 'xhs', 视频号: 'channels' }
const vlog = reactive({ platform: '抖音', link: '', title: '', cover: '' })
async function pickCover() {
  const path = await chooseImage()
  if (!path) return
  try {
    const up = await uploadTo('/app/upload/image', path)
    vlog.cover = up.data.url
  } catch (e) {
    toast(errText(e, '封面上传失败'))
  }
}
const copyLink = () => (vlog.link ? copy(vlog.link, '已复制链接') : toast('请先粘贴视频链接'))
const submittedCount = ref(0)
const vlogTip = computed(() => `本次已提交 ${submittedCount.value} 条 · 视频先发布到抖音 / 小红书 / 视频号，再粘贴链接提交审核`)
const previewVideo = () => (vlog.link ? copy(vlog.link, `已复制链接，可在${vlog.platform}打开预览`) : toast('请先粘贴视频链接'))
async function addMore() {
  if (!vlog.link && !vlog.title) return toast('先填写当前这条视频的链接和标题')
  if (!(await confirm('继续添加', '先提交当前这条，再清空表单填写下一条？'))) return
  submitVlog(true)
}
const saveVlogDraft = () => {
  // 草稿只存本机；存不下（空间满等）要如实说，不能照样提示已保存
  try { uni.setStorageSync('kangaroo:vlog-draft', { ...vlog }) } catch (e) { return toast('草稿保存失败') }
  toast('已保存草稿（仅本机）')
}
async function submitVlog(stay) {
  let stayId = editingId.value
  if (!stayId) {
    const rows = data.value.rows || []
    if (!rows.length) return toast('请先新建房源')
    const i = await pickPaged(rows.map(r => r.stayName), '选择房源')
    if (i < 0) return
    stayId = rows[i].stayId
  }
  if (!vlog.cover) return toast('请上传封面图')
  if (!vlog.title.trim()) return toast('请填写内容标题')
  if (!/^https?:\/\//.test(vlog.link)) return toast('请粘贴以 http(s):// 开头的视频链接')
  if (!(await confirm('授权声明', '我已获得视频中出镜人员的授权，同意将该视频用于袋鼠全球青年官方推广。')) || busy) return
  busy = true
  try {
    const res = await apiStaffCreateVlog(currentStaffStoreId(), {
      stayId, platform: PLATFORM[vlog.platform], link: vlog.link, title: vlog.title.trim(), cover: vlog.cover, authorRole: 'host',
      authorized: true, authorizer: form.hostName || experience.account?.nickname || ''
    })
    try { uni.removeStorageSync('kangaroo:vlog-draft') } catch (e) { /* ignore */ }
    submittedCount.value += 1
    toast(res.msg || '已提交')
    // 之前只有「继续添加」会清空表单：「下一步」去审核详情后再返回，表单还是刚提交的那条，再点一次就重复提交
    Object.assign(vlog, { link: '', title: '', cover: '' })
    if (stay !== true) go(R.staffVlog + '?s=2&vlogId=' + res.data.vlogId)
  } catch (e) {
    toast(errText(e, '提交失败'))
  } finally {
    busy = false
  }
}
// ---------------- s=5 视频与生活碎片（2026-10-17 R3） ----------------
// 只有这一页用：直接在员工分包里调接口（不往主包的 common/api.js 里加）；视频上传用员工分包里的 stay-video.js
const EMPTY_MEDIA = () => ({ stayId: 0, stayName: '', status: '', cover: '', introVideo: { url: '', cover: '' },
  diary: { bg: '', title: '', subtitle: '', intro: '', defaultTitle: '小院日记', defaultSubtitle: '把日子过成一段可以翻看的记忆' }, roomTypes: [], entries: [] })
const media = ref(EMPTY_MEDIA())
const mediaApi = (id) => '/app/staff/stay/stays/' + id
const setMedia = (data) => { media.value = { ...EMPTY_MEDIA(), ...(data || {}) } }
async function openMedia(stayId) {
  try {
    setMedia((await get(mediaApi(stayId) + '/media')).data)
    s.value = 5
  } catch (e) {
    toast(errText(e, '加载失败'))
  }
}
const diaryIntroText = computed(() => String(media.value.diary.intro || '').split('\n').filter(Boolean).join(' / '))
const mediaThumb = (p) => (p ? absUrl(p) : '/static/media/cover-empty.png')
const videoTip = `mp4 / mov，${INTRO_MAX_SECONDS / 60} 分钟、${INTRO_MAX_MB}MB 以内（房型和生活碎片视频 ${VIDEO_MAX_SECONDS} 秒内）；从相册选，上线中的房源也能直接换，住客马上看到`
const mediaNote = computed(() => (media.value.stayName ? media.value.stayName + '：视频和生活碎片是补充展示内容，上线中也能直接改，不用下架重审' : ''))
// 选 + 传一个视频（选好、检查过才转圈）；取消返回 null
async function pickAndUploadVideo(intro = false) {
  try {
    return await chooseAndUploadVideo((pct) => uni.showLoading({ title: '视频上传中 ' + pct + '%', mask: true }), {
      upload: (f, cb) => { uni.showLoading({ title: '视频上传中', mask: true }); return uploadVideoParts(f, cb) }
    }, { intro })
  } finally {
    uni.hideLoading()
  }
}
async function pickAndUploadImage() {
  const path = await chooseImage()
  if (!path) return ''
  uni.showLoading({ title: '上传中', mask: true })
  try {
    return (await uploadTo('/app/upload/image', path)).data.url
  } finally {
    uni.hideLoading()
  }
}
// 改动类操作统一：防连点、成功后用接口返回的最新数据刷新这一屏
let mediaBusy = false
async function mediaRun(work, okText) {
  if (mediaBusy) return
  mediaBusy = true
  try {
    const res = await work()
    if (res && res.data) {
      setMedia(res.data)
      toast(okText || res.msg || '已保存')
    }
  } catch (e) {
    toast(errText(e, '操作失败'))
  } finally {
    mediaBusy = false
  }
}
const sid = () => media.value.stayId
// 小院视频（详情页「3分钟看小院」）：3 分钟、200MB 以内（2026-10-17 放宽；房型和生活碎片视频仍是 1 分钟）
const uploadIntroVideo = () => mediaRun(async () => {
  const v = await pickAndUploadVideo(true)
  return v && v.url ? put(mediaApi(sid()) + '/intro-video', { url: v.url, cover: v.cover }) : null
}, '小院视频已更新')
const changeIntroCover = () => mediaRun(async () => {
  const cover = await pickAndUploadImage()
  return cover ? put(mediaApi(sid()) + '/intro-video', { url: media.value.introVideo.url, cover }) : null
}, '封面已更新')
const removeIntroVideo = () => mediaRun(async () => (await confirm('删除小院视频', '删掉后房源详情不再显示「3分钟看小院」。')) ? put(mediaApi(sid()) + '/intro-video', { url: '' }) : null, '已删除')
const tapIntroVideo = () => (media.value.introVideo.url ? playVideoFull(absUrl(media.value.introVideo.url), mediaThumb(media.value.introVideo.cover || media.value.cover)) : uploadIntroVideo())
const roomApi = (rt) => '/app/staff/stay/room-types/' + rt.roomTypeId + '/video'
const uploadRoomVideo = (rt) => mediaRun(async () => {
  const v = await pickAndUploadVideo()
  return v && v.url ? put(roomApi(rt), { url: v.url, cover: v.cover }) : null
}, rt.typeName + '的视频已更新')
const tapRoomVideo = (rt) => (rt.videoUrl ? playVideoFull(absUrl(rt.videoUrl), mediaThumb(rt.videoCover || rt.cover)) : uploadRoomVideo(rt))
async function manageRoomVideo(rt) {
  if (!rt.videoUrl) return uploadRoomVideo(rt)
  const i = await sheet(['预览视频', '换视频', '换封面', '删除视频'])
  if (i === 0) tapRoomVideo(rt)
  if (i === 1) uploadRoomVideo(rt)
  if (i === 2) mediaRun(async () => { const cover = await pickAndUploadImage(); return cover ? put(roomApi(rt), { url: rt.videoUrl, cover }) : null }, '封面已更新')
  if (i === 3) mediaRun(async () => (await confirm('删除房型视频', '删掉后房型卡不再显示「≤1分钟」视频。')) ? put(roomApi(rt), { url: '' }) : null, '已删除')
}
async function changeDiaryBg() {
  const i = media.value.diary.bg ? await sheet(['更换背景图', '恢复默认（用房源封面）']) : 0
  if (i < 0) return
  mediaRun(async () => {
    const bg = i === 1 ? '' : await pickAndUploadImage()
    return i === 1 || bg ? put(mediaApi(sid()) + '/diary-header', { bg }) : null
  }, '背景图已更新')
}
async function editDiaryTitle() {
  const v = await prompt('生活碎片标题', { value: media.value.diary.title, placeholder: '不填就叫「小院日记」，最多 32 字' })
  if (v === null) return
  if (v.length > 32) return toast('标题最多 32 个字')
  mediaRun(() => put(mediaApi(sid()) + '/diary-header', { title: v }), '标题已保存')
}
async function editDiarySubtitle() {
  const v = await prompt('生活碎片副标题', { value: media.value.diary.subtitle || '', placeholder: '最多 80 字，清空后恢复默认文案' })
  if (v === null) return
  if (v.length > 80) return toast('副标题最多 80 个字')
  mediaRun(() => put(mediaApi(sid()) + '/diary-header', { subtitle: v }), '副标题已保存')
}
// 系统输入框只有一行：几行文案用「/」隔开，存的时候换成换行（服务端最多 3 行、255 字）
async function editDiaryIntro() {
  const v = await prompt('生活碎片文案', { value: String(media.value.diary.intro || '').split('\n').join(' / '), placeholder: '最多 3 句，用 / 隔开，如：花开有信，晚风有约 / 路过的人，都会留下一点故事' })
  if (v === null) return
  const lines = v.split(/[\/／]/).map(x => x.trim()).filter(Boolean)
  if (lines.length > 3) return toast('文案最多 3 句')
  if (lines.join('\n').length > 255) return toast('文案最多 255 个字')
  mediaRun(() => put(mediaApi(sid()) + '/diary-header', { intro: lines.join('\n') }), '文案已保存')
}
// ---- 生活碎片每一条（2026-11-03 主人：简化）----
// 原来：点「添加」弹 3 个框（照片还是视频 / 写一句话 / 日期）→ 现在：两个大钮选好文件，列表顶部出一张「还没保存」的卡，一句话、日期在卡上填，点「保存」才发请求；
// 原来：点一条弹 6 项菜单（预览 / 改一句话 / 改日期 / 往前 / 往后 / 删除）→ 现在：一句话直接在卡上改、日期点一下改、改了出「保存」；上移 / 下移 / 删除是卡上的小钮；点图预览
const diaryDraft = ref(null)
const diaryOne = (entry) => '/app/staff/stay/diary/' + entry.diaryId
async function addDiary(kind) {
  if ((media.value.entries || []).length >= 200) return toast('最多 200 条，请先删掉一些旧的')
  if (diaryDraft.value) return toast('先把上面那条保存，或点「不要了」')
  if (mediaBusy) return
  mediaBusy = true
  try {
    if (kind === 'video') {
      const v = await pickAndUploadVideo()
      if (!v || !v.url) return
      diaryDraft.value = { mediaType: 'video', url: v.url, cover: v.cover || '', caption: '', shotDate: todayCn() }
    } else {
      const url = await pickAndUploadImage()
      if (!url) return
      diaryDraft.value = { mediaType: 'image', url, cover: url, caption: '', shotDate: todayCn() }
    }
  } catch (e) {
    toast(errText(e, '上传失败'))
  } finally {
    mediaBusy = false
  }
}
async function pickDraftDate() {
  const d = diaryDraft.value
  if (!d) return
  const v = await pickDate({ title: '拍摄日期', value: d.shotDate || todayCn(), max: todayCn() })
  if (v) d.shotDate = v
}
const previewDraft = () => {
  const d = diaryDraft.value
  if (!d) return
  if (d.mediaType === 'video') return playVideoFull(absUrl(d.url), mediaThumb(d.cover))
  return uni.previewImage({ urls: [absUrl(d.url)] })
}
// 一句话最多 32 字（服务端 CAPTION_MAX 一样）；超了就地提示，不发
const captionProblem = (caption) => (String(caption || '').length > 32 ? '一句话最多 32 个字' : '')
function saveDraftDiary() {
  const d = diaryDraft.value
  if (!d) return
  const bad = captionProblem(d.caption)
  if (bad) return toast(bad)
  mediaRun(async () => {
    const res = await post(mediaApi(sid()) + '/diary', { mediaType: d.mediaType, url: d.url, cover: d.mediaType === 'video' ? d.cover : undefined, caption: String(d.caption || '').trim(), shotDate: d.shotDate })
    diaryDraft.value = null
    return res
  }, '已添加')
}
// 每条正在改但还没保存的一句话 / 日期：diaryId → { caption?, shotDate? }；保存成功或接口刷新后清掉
const diaryEdits = ref({})
const diaryCards = computed(() => (media.value.entries || []).map(entry => {
  const edit = diaryEdits.value[entry.diaryId] || {}
  const caption = 'caption' in edit ? edit.caption : (entry.caption || '')
  const shotDate = 'shotDate' in edit ? edit.shotDate : (entry.shotDate || '')
  return { ...entry, caption, shotDate, dirty: caption !== (entry.caption || '') || shotDate !== (entry.shotDate || '') }
}))
const setDiaryEdit = (entry, patch) => { diaryEdits.value = { ...diaryEdits.value, [entry.diaryId]: { ...(diaryEdits.value[entry.diaryId] || {}), ...patch } } }
const editDiaryCaption = (entry, e) => setDiaryEdit(entry, { caption: String((e && e.detail && e.detail.value) || '') })
async function editDiaryDate(entry) {
  const v = await pickDate({ title: '拍摄日期', value: entry.shotDate || todayCn(), max: todayCn() })
  if (v) setDiaryEdit(entry, { shotDate: v })
}
function saveDiary(entry) {
  const bad = captionProblem(entry.caption)
  if (bad) return toast(bad)
  mediaRun(async () => {
    const res = await put(diaryOne(entry), { caption: String(entry.caption || '').trim(), shotDate: entry.shotDate || undefined })
    const rest = { ...diaryEdits.value }
    delete rest[entry.diaryId]
    diaryEdits.value = rest
    return res
  }, '已保存')
}
const previewDiary = (entry) => {
  if (entry.type === 'video') return playVideoFull(absUrl(entry.url), mediaThumb(entry.cover))
  return uni.previewImage({ urls: [absUrl(entry.url)] })
}
// 上移 / 下移：把这一条和相邻的一条换位置，整个顺序发给服务端
async function moveDiary(entry, idx, dir) {
  const list = media.value.entries || []
  const j = idx + dir
  if (j < 0 || j >= list.length) return toast(dir < 0 ? '已经在最前面了' : '已经在最后面了')
  const ids = list.map(x => x.diaryId)
  ids.splice(j, 0, ids.splice(idx, 1)[0])
  return mediaRun(() => put(mediaApi(sid()) + '/diary-order', { ids }), '顺序已调整')
}
// 删除保留一次确认（删了住客就看不到了，不能撤销）
async function deleteDiary(entry) {
  if (await confirm('删除这条生活碎片', '删掉后住客就看不到了。')) mediaRun(() => del(diaryOne(entry)), '已删除')
}
// 2026-11-03 主人：「我需要退出来登进去来回点击」。原因：本页只在进页、切回列表屏时拉数据，没有 onShow —— 从「房型管理」「数据」「上传 Vlog」
// 这些别的页回来，看到的还是进页时那一份，只有退出去再进来才刷新。现在每次回到本页都按当前这一屏重新拉；
// 填写屏（s=2 房源信息、s=4 Vlog）有没保存的内容，不动
let shownOnce = false
onShow(() => {
  if (!shownOnce) { shownOnce = true; return }
  if (s.value === 1) loadList()
  else if (s.value === 3 && editingId.value && !submissionWorking()) refreshSubmission()
  else if (s.value === 5 && media.value.stayId) refreshMedia()
})
async function refreshSubmission() {
  try {
    const st = (await apiStaffStay(editingId.value)).data
    if (st && s.value === 3 && st.stayId === editingId.value) stayInfo.value = st
  } catch (e) { /* 拉不到就留着原来的，页面上的操作照常能用 */ }
}
async function refreshMedia() {
  try {
    const id = media.value.stayId
    const data = (await get(mediaApi(id) + '/media')).data
    if (s.value === 5 && media.value.stayId === id) setMedia(data)
  } catch (e) { /* 同上 */ }
}
const onBack = () => {
  if (submissionWorking()) return toast('正在保存，请稍候')
  if (s.value === 1 || s.value === landing) return back()
  const to = s.value === 3 ? backTo : 1
  backTo = 1
  s.value = to
}
</script>

<style scoped lang="scss">
/* 新增 / 编辑房源、资质、Vlog（s=2、3、4）的样式在 ./form-clean.scss，和招募、创建活动、线上任务发布共用 */
@import './form-clean.scss';
.submission-link { color: var(--k-red-deep); font-size: 15px; flex-shrink: 0; padding: 12px 0; }
.submission-cover { width: 64px; height: 48px; border-radius: 8px; flex-shrink: 0; }
.submission-missing { display: block; }
/* 配套设施点选（2026-11-03 主人：「增加一个对勾…能清楚的看到我选了那个」）：三列等宽，每格 48px 高；
   没选 = 浅底深字 + 空心圆圈；选中 = 暖棕底白字 + 白圆里一个棕色对勾（不只靠颜色区分，有没有对勾一眼看得出） */
.fac-chips { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.fac-chip { min-height: 48px; padding: 0 8px; border-radius: 12px; background: var(--k-paper2); display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 15px; color: var(--k-ink); box-sizing: border-box; }
.fac-chip__mark { flex-shrink: 0; width: 20px; height: 20px; border: 1.5px solid var(--k-muted); border-radius: 50%; background: var(--k-paper); box-sizing: border-box; display: flex; align-items: center; justify-content: center; }
.fac-chip--on { background: var(--k-red-deep); color: var(--k-paper); font-weight: 600; }
.fac-chip--on .fac-chip__mark { border-color: var(--k-paper); }
.submission-cover + .submission-link { margin-left: 4px; }
/* 「房源封面必填」：嵌在标题里的「必填」和标题隔开一点，和别的行「营业执照 必填」一样（网页版嵌套 text 外面多一层 span，所以不用「>」） */
.fc-row__k .fc-req { margin-left: 6px; }
/* 2026-11-17 改版「小而精」（房源列表）：浅灰底、页边距 12；筛选是 28 高的白色胶囊，三个数字是一张白卡，页签选中用主色；
   每个房源一张白卡（12 圆角、不描边），照片 84、名字 15 / 600，下面五个操作还是整行等分、56 高、字 14（2026-11-03 定的，没动），只是不再画框和竖线 */
.rooms :deep(.k-button) { border-radius: 999px; }
.list-body { padding: 8px 12px calc(132px + var(--k-safe-bottom)); }
.filters { display: flex; align-items: center; gap: 8px; }
.dd { display: flex; align-items: center; gap: 4px; height: 28px; padding: 0 12px; border-radius: 999px; background: var(--k-paper); font-size: 12px; color: var(--k-ink2); }
.filters__icon { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; }
.filters__filter { display: flex; align-items: center; gap: 4px; min-height: 32px; font-size: 13px; color: var(--k-ink2); }
.stats { margin-top: 8px; display: flex; align-items: center; height: 60px; padding: 0 8px; border-radius: 12px; background: var(--k-paper); }
.stats__item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; }
/* 11-18 精修词典「数据格」：数字 18 / 700 / 墨色、等宽，不再分棕 / 绿 / 靛蓝三种颜色 */
.stats__num { font-size: 18px; font-weight: 700; line-height: 1.2; font-family: var(--k-sans); color: var(--k-ink); font-variant-numeric: tabular-nums; }
.stats__label { font-size: 11px; color: var(--k-muted); }
.stats__line { width: 1px; height: 24px; background: var(--k-line); }
/* 词典「页签」：14 号，未选灰、选中墨色 600，下面 16×3 的暖棕短条，行高 40 */
.tabs { margin-top: 8px; display: flex; border-radius: 12px; background: var(--k-paper); overflow: hidden; }
.tabs__item { position: relative; flex: 1; height: 40px; display: flex; align-items: center; justify-content: center; font-size: 14px; color: var(--k-muted); }
.tabs__item.active { color: var(--k-ink); font-weight: 600; }
.tabs__item.active::after { content: ""; position: absolute; left: 50%; bottom: 4px; width: 16px; height: 3px; margin-left: -8px; border-radius: 2px; background: var(--k-red); }
.room { margin-top: 8px; padding: 12px 12px 0; border-radius: 12px; background: var(--k-paper); }
.room__main { display: flex; gap: 10px; padding-bottom: 12px; }
.room__img { width: 84px; height: 84px; border-radius: 8px; flex: 0 0 auto; background: var(--k-paper2); }
.room__name { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-family: var(--k-sans); font-weight: 600; font-size: 15px; line-height: 22px; }
.room__chip { flex-shrink: 0; margin-left: 8px; }
.room__addr { display: block; margin-top: 3px; font-size: 12px; line-height: 17px; color: var(--k-muted); }
.room__note { margin-top: 6px; }
.room__kpi { display: flex; align-items: center; margin-top: 8px; font-size: 12px; }
.room__kpi-label { color: var(--k-muted); margin-right: 6px; }
.room__kpi-val { font-weight: 600; color: var(--k-ink); font-variant-numeric: tabular-nums; }
.room__kpi-line { width: 1px; height: 14px; background: var(--k-line2); margin: 0 12px 0 22px; }
/* 2026-11-03：五个操作整行等分，每个 56px 高、字 14px（年纪大的同事点得准、看得清） */
.room__actions { position: relative; display: flex; margin: 0 -6px; }
/* 操作区上面一条发丝线，左右和卡片内容对齐 */
.room__actions::before { content: ''; position: absolute; left: 6px; right: 6px; top: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); }
.room__act { flex: 1; min-width: 0; min-height: 56px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; font-size: 14px; color: var(--k-ink); }
/* 2026-11-03：第四个按钮是主操作（提交审核 / 下架 / 审核中），棕字加粗，字可以缩到 13px 保证「提交审核」四个字一行放得下 */
.room__act--main { color: var(--k-red-deep); font-weight: 600; font-size: 13px; }
/* 窄屏（宽 360 以内）：五个四字的按钮不画竖线后会连成一片，字收到 13、往两边多放一点，留出空当 */
@media (max-width: 360px) { .room__actions { margin: 0 -10px; } .room__act { font-size: 13px; } }
/* 下架原因就在卡片下面填：一行说明、一个输入框、两个 48px 的钮 */
.room__offline { margin: 4px 0 12px; padding: 12px; border-radius: 12px; background: var(--k-red-soft); }
.room__offline-t { display: block; margin-bottom: 8px; font-size: 14px; line-height: 20px; color: var(--k-ink2); }
.room__offline-btns { display: flex; gap: 10px; margin-top: 10px; }
.room__obtn { flex: 1; min-width: 0; height: 48px; border-radius: 12px; background: var(--k-red-deep); color: var(--k-paper); display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 600; }
.room__obtn--ghost { background: var(--k-paper); color: var(--k-ink); border: 1px solid var(--k-line2); box-sizing: border-box; }
/* 底栏 2026-11-17 起是 50 高：「新增房源」这一条贴着它，中间不留缝；下边多留 10，让开底栏中间凸起来的「发布」圆钮（凸出 16） */
/* 词典「底部操作条」：白底 + 顶上一条发丝线，卡片滑到下面时边界清楚 */
.fab-bar { position: fixed; left: 0; right: 0; bottom: calc(50px + var(--k-safe-bottom)); z-index: 49; padding: 8px 12px 18px; background: var(--k-paper); }
.fab-bar::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); }

.sec-title { display: block; font-family: var(--k-sans); font-weight: 700; font-size: 16px; line-height: 22px; margin-bottom: 8px; }

/* 资质（s=3）：文件名长就省略，只占一行；审核进度字不小于 13px；进度只用一种强调色 */
.notice { margin-bottom: 12px; padding: 10px 12px; border-radius: 12px; background: var(--k-ochre-soft); color: var(--k-ochre-deep); font-size: 13px; line-height: 1.6; }
.doc-name { max-width: 68%; }
.doc-file { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.fc-row__v.doc-expired { color: var(--k-alert); }
.doc-result { display: block; font-weight: 600; }
.doc-result__time { font-weight: 400; }
.timeline { display: flex; padding: 4px 8px 16px; }
.timeline__item { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; }
.timeline__track { position: relative; width: 100%; height: 22px; display: flex; align-items: center; justify-content: center; }
.timeline__line { position: absolute; top: 50%; height: 1px; background: var(--k-line2); }
.timeline__line.done { background: var(--k-red-deep); }
.timeline__line--l { left: 0; right: 50%; margin-right: 10px; }
.timeline__line--r { left: 50%; right: 0; margin-left: 10px; }
.timeline__dot { position: relative; z-index: 1; width: 20px; height: 20px; border-radius: 50%; border: 1px solid var(--k-line2); background: var(--k-paper); display: flex; align-items: center; justify-content: center; }
.timeline__dot.done { border-color: var(--k-red-deep); background: var(--k-red-deep); }
.timeline__title { font-size: 14px; line-height: 20px; }
.timeline__time { font-size: 13px; line-height: 18px; color: var(--k-muted); }

/* Vlog（s=4）：封面是竖版 */
.fc-cover.vlog-cover { width: 75px; height: 100px; }
/* 2026-10-17 R2 的点选行：现在只有视频与生活碎片（s=5）还在用 */
/* 11-18：四行收进一张白卡（词典「列表行」），行间发丝线左缩进 12；字号 14 / 15 不缩（这屏有输入框，按填写页处理） */
.picks { display: flex; flex-direction: column; gap: 0; border-radius: 12px; background: var(--k-paper); overflow: hidden; }
.pick { position: relative; display: flex; align-items: center; gap: 8px; min-height: 48px; padding: 0 12px; border-radius: 0; background: transparent; box-sizing: border-box; }
.pick + .pick::before { content: ''; position: absolute; left: 12px; right: 0; top: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); }
.pick__k { flex: 0 0 auto; font-size: 14px; font-weight: 500; color: var(--k-ink); }
.pick__val { min-width: 0; font-size: 15px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.pick__val--empty { color: var(--k-muted); }
/* 2026-10-17 R3：视频与生活碎片（s=5） */
/* 2026-11-17 改版「小而精」（视频与生活碎片）：卡片、行都是白底 12 圆角、不描边，照片 8 圆角，按钮收成胶囊；点击高度（44 / 52）没动 */
.diary-bg-preview { display: block; width: 100%; height: 140px; margin-top: 10px; border-radius: 12px; }
.media-body { padding: 8px 12px calc(96px + var(--k-safe-bottom)); }
.mcard { padding: 10px; border-radius: 12px; background: var(--k-paper); }
.mcard__cover { position: relative; width: 100%; height: 0; padding-bottom: 56.25%; border-radius: 8px; overflow: hidden; background: #F7F5F2; }
.mcard__img { position: absolute; left: 0; top: 0; width: 100%; height: 100%; }
.mcard__play { position: absolute; left: 50%; top: 50%; width: 44px; height: 44px; margin: -22px 0 0 -22px; border-radius: 50%; background: rgba(36,27,23,.45); border: 1px solid rgba(255,255,255,.85); box-sizing: border-box; display: flex; align-items: center; justify-content: center; }
.mcard__play--sm { width: 26px; height: 26px; margin: -13px 0 0 -13px; }
.mcard__empty { position: absolute; left: 0; top: 0; right: 0; bottom: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; color: var(--k-muted); font-size: 13px; }
.mcard__acts { margin-top: 10px; display: flex; gap: 8px; }
.mact { flex: 0 0 auto; height: 32px; padding: 0 14px; border: 1px solid var(--k-red-line); border-radius: 999px; background: var(--k-paper); color: var(--k-red-deep); font-size: 13px; display: flex; align-items: center; }
.mact--del { border-color: var(--k-line2); color: var(--k-muted); }
.mrow { margin-top: 8px; padding: 8px; border-radius: 12px; background: var(--k-paper); display: flex; align-items: center; gap: 10px; }
.mrow__thumb { position: relative; width: 72px; height: 54px; border-radius: 8px; overflow: hidden; flex: 0 0 auto; background: var(--k-paper2); }
.mrow__copy { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.mrow__name { font-size: 15px; font-weight: 600; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.mrow__state { font-size: 12px; color: var(--k-muted); }
/* 2026-11-03 生活碎片改成一条一张卡（原来九宫格 + 点开 6 项菜单）：两个 52px 的添加钮；卡上左图右字，一句话是输入框、日期点一下改；
   底下一排小钮都 44px 高；新加还没保存的那张卡用棕色虚线框标出来。placeholder-class 编译后不带 data-v，所以 .d-ph 要 :global */
:global(.d-ph) { color: var(--k-muted); font-size: 15px; }
.dadd { margin-top: 10px; display: flex; gap: 8px; }
.dadd__btn { flex: 1; min-width: 0; min-height: 52px; padding: 0 8px; border: 1px dashed var(--k-red-line); border-radius: 12px; background: var(--k-red-soft); display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 14px; font-weight: 600; color: var(--k-red-deep); box-sizing: border-box; text-align: center; }
.dcard { margin-top: 8px; padding: 10px; border: 1px solid transparent; border-radius: 12px; background: var(--k-paper); }
.dcard--new { border: 1px dashed var(--k-red-line); background: var(--k-red-soft); }
.dcard__top { display: flex; gap: 10px; }
.dcard__thumb { position: relative; flex: 0 0 auto; width: 88px; height: 88px; border-radius: 8px; overflow: hidden; background: var(--k-paper2); }
.dcard__ph { background: #3A322B; }
.dcard__fields { min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.dcard__tag { font-size: 12px; font-weight: 600; color: var(--k-red-deep); }
.dcard__hidden { align-self: flex-start; height: 17px; padding: 0 5px; border-radius: 4px; background: var(--k-alert-soft); color: var(--k-alert); font-size: 10px; font-weight: 500; line-height: 17px; }
.dcard__input { box-sizing: border-box; width: 100%; height: 44px; padding: 0 10px; border: 1px solid var(--k-line2); border-radius: 12px; background: var(--k-paper); font-size: 15px; color: var(--k-ink); }
.dcard__date { display: flex; align-items: center; gap: 4px; min-height: 44px; font-size: 14px; color: var(--k-ink2); } /* 2026-11-03 复查：能点的行不矮于 44px */
.dcard__btns { display: flex; gap: 6px; margin-top: 10px; }
.dbtn { flex: 1; min-width: 0; min-height: 44px; border: 1px solid var(--k-line2); border-radius: 999px; background: var(--k-paper); display: flex; align-items: center; justify-content: center; gap: 4px; font-size: 14px; color: var(--k-ink); box-sizing: border-box; }
.dbtn--off { opacity: .4; }
.dbtn--del { color: var(--k-muted); }
.dbtn--ghost { color: var(--k-muted); }
.dbtn--main { border-color: var(--k-red-deep); background: var(--k-red-deep); color: var(--k-paper); font-weight: 600; }
.trip-hint { display: block; font-size: 12px; line-height: 1.6; color: var(--k-muted); }
.mcard .trip-hint { margin-top: 8px; }
</style>
