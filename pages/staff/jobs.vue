<template>
  <!-- #ifdef MP-WEIXIN -->
  <page-meta :page-style="(s === 2 && (startCalendar || sheetKey)) || (s === 1 && (condSheet || photoSheet || extrasSheet)) ? 'overflow: hidden' : ''" />
  <!-- page-meta 必须是页面第一个节点。日历、底部弹层开着时锁住页面滚动：弹框里的 scroll-view 不能用 catchtouchmove 拦（拦了它自己也滑不动）。
       日历、底部弹层只在发布屏里显示，系统返回切回列表时它的状态还留着，所以要带上 s === 2，否则列表屏会滑不动；列表屏的「补填筛选条件」「换岗位照片」「住宿与宠物」弹层同理带上 s === 1。
       只在小程序里加：H5 的 page-meta 关弹窗时清不掉这条样式，顶栏会从此不吸顶（H5 用 lockPageScroll 锁 body） -->
  <!-- #endif -->
  <k-feature-gate feature="recruitment">
  <view class="k-page staff-jobs">
    <template v-if="s===1">
      <k-topbar title="岗位列表" back />
      <view class="jobs-list k-pad-tab">
        <view class="search-row"><view class="search-box" hover-class="k-press-s" @click="askKeyword"><k-icon name="search" :size="20" color="muted" /><text>{{ keyword || '搜索岗位 / 关键词 / 地点 / 编号' }}</text></view><button class="filter-button" @click="pickStatus"><text>{{ statusFilterLabel }}</text></button></view>
        <!-- 补填筛选条件（10-16 跟进）：已上架的线下岗位里，性别 / 排班 / 住宿 / 在店一项都没填的有几个（服务端按全店数，不受下面的筛选影响）。
             这些岗位在用户按条件筛时看不到；只给有岗位编辑权限的人看，点「去补填」打开最新的那一个 -->
        <view v-if="draftRows.length" class="cond-banner"><k-icon name="store" :size="18" color="red" /><text class="cond-banner__text">{{ draftRows.length }} 个商家岗位等你完善并上架</text><view class="cond-banner__btn" hover-class="k-press-s" @click="jobActions(draftRows[0])"><text>去处理</text></view></view>
        <view v-if="canEdit && missingCount > 0" class="cond-banner"><k-icon name="list-filter" :size="18" color="red" /><text class="cond-banner__text">{{ missingCount }} 个岗位还没填排班 / 住宿等条件，补上后更容易被用户筛到</text><view class="cond-banner__btn" hover-class="k-press-s" @click="fillFirstMissing"><text>去补填</text></view></view>
        <!-- 2026-11-03 主人：简化商家端。合作商家不看四个指标（缺人中 / 匹配率这些是内部运营看的），卡片只留状态 + 报名数，按钮直接摆在卡片上 -->
        <view v-if="!merchantStaff" class="metrics"><view v-for="m in metrics" :key="m.label"><text>{{m.label}}</text><text :class="m.tone">{{m.value}}</text></view></view>
        <view class="job-tabs"><text :class="{active:type===''}" @click="setType('')">全部</text><text :class="{active:type==='volunteer'}" @click="setType('volunteer')">换工</text><text :class="{active:type==='parttime'}" @click="setType('parttime')">兼职</text><text :class="{active:type==='fulltime'}" @click="setType('fulltime')">全职</text><text v-if="staffCan('online', 'view')" :class="{active:type==='online'}" @click="setType('online')">线上任务</text></view>
        <!-- 卡片：员工点了弹操作菜单（jobActions）；合作商家（2026-11-03 主人：简化）点了直接看岗位详情，分享 / 暂停 / 恢复三个大按钮摆在卡片上，不弹菜单；待上架的只写一句去向 -->
        <view class="job-list"><view v-for="j in jobList" :key="j.jobId" class="job-card" :class="{ 'job-card--merchant': merchantStaff }" hover-class="k-press-s" @click="cardTap(j)"><image :src="j.img" mode="aspectFill" /><view class="job-main"><view><text class="job-title">{{j.title}}</text><text v-if="canEdit && j.conditionsMissing" class="job-cond">待补条件</text><text class="job-status" :class="j.tone">{{j.status}}</text></view><text class="job-meta">{{ [[j.city, j.area].filter(Boolean).join(' · '), j.type, j.people != null ? j.people + ' 人' : ''].filter(Boolean).join('　|　') }}</text><view class="job-stats"><text>报名 <text>{{j.apply}}</text></text><template v-if="!merchantStaff"><text>匹配率 <text class="green-text">{{ j.match == null || j.match === '' ? '—' : j.match + '%' }}</text></text><text>分享访问 <text>{{j.visits}}</text></text></template></view></view>
          <view v-if="merchantStaff" class="job-acts" @click.stop><template v-if="merchantActs(j).length"><view v-for="a in merchantActs(j)" :key="a" class="job-act" :class="{ 'job-act--main': a === '分享' }" hover-class="k-press-s" @click="merchantAct(j, a)"><text>{{ a }}</text></view></template><text v-else-if="j.rawStatus === 'draft'" class="job-acts__tip">{{ MERCHANT_DRAFT_TIP }}</text></view>
        </view></view>
        <!-- 没有岗位编辑权限的角色：两个按钮都淡显，点了说明原因（之前「发布岗位」是 disabled 却仍是实心红色，点了没有任何反应）。合作商家没有「批量管理」（2026-11-03 主人：简化） -->
        <view class="list-actions"><button v-if="!merchantStaff" :class="{ off: !canEdit }" @click="batchManage"><text>批量管理</text></button><button :class="{ off: !canEdit }" @click="startPublish"><text>发布岗位</text></button></view>
      </view><k-tabbar mode="staff" active="work" />
      <!-- 补填筛选条件弹层：选项、适用范围和发布页同一组（性别偏好只有换宿、住宿条件只有包住、最短在店 7 / 15 / 20 / 30 / 不限），打开时带出当前值。
           标题和按钮区不随内容滚、拖动时拦住；中间的选项区超高时自己滚（320 宽、640 高也放得下按钮） -->
      <view v-if="condSheet" class="chip-pop cond-sheet">
        <view class="chip-pop__mask" @click="closeConditions" @touchmove.stop.prevent />
        <view class="chip-pop__panel">
          <view class="chip-pop__head" @touchmove.stop.prevent><text class="chip-pop__title">补填筛选条件</text><text class="chip-pop__hint cond-sheet__job">{{ condSheet.title }}</text></view>
          <scroll-view scroll-y class="chip-pop__scroll cond-sheet__scroll">
            <text v-if="condSheet.genderPlan" class="fc-note">招募计划：{{ condSheet.genderPlan }}（在岗位管理中修改）</text><template v-else-if="condSheet.jobType==='volunteer'"><text class="cond-sheet__label">性别偏好</text><view class="seg three"><text v-for="genderItem in GENDER_OPTS" :key="genderItem[1]" :class="{active:condSheet.draft.genderPref===genderItem[1]}" @click="condSheet.draft.genderPref=genderItem[1]">{{ genderItem[0] }}</text></view></template>
            <text class="cond-sheet__label">休息排班</text><view class="chip-pop__chips cond-sheet__chips"><text v-for="restItem in REST_MODES" :key="restItem[1]" class="chip-pop__chip" :class="{ on: condSheet.draft.restMode===restItem[1] }" @click="toggleCond('restMode', restItem[1])">{{ restItem[0] }}</text></view>
            <template v-if="condSheet.housing"><text class="cond-sheet__label">住宿条件</text><view class="chip-pop__chips cond-sheet__chips"><text v-for="roomItem in ROOM_TYPES" :key="roomItem[1]" class="chip-pop__chip" :class="{ on: condSheet.draft.roomType===roomItem[1] }" @click="toggleCond('roomType', roomItem[1])">{{ roomItem[0] }}</text></view></template>
            <text class="cond-sheet__label">最短在店</text><view class="seg five"><text v-for="dayItem in MIN_DAY_OPTS" :key="dayItem[0]" :class="{active:(condSheet.draft.minDays||null)===dayItem[1]}" @click="condSheet.draft.minDays=dayItem[1]">{{ dayItem[0] }}</text></view>
            <text class="insurance-hint">{{ condHint }}</text>
          </scroll-view>
          <view class="chip-pop__foot" @touchmove.stop.prevent><view class="chip-pop__btn"><k-button block type="secondary" label="取消" @click="closeConditions" /></view><view class="chip-pop__btn chip-pop__btn--main"><k-button block :label="condSaving ? '保存中…' : '保存'" @click="saveConditions" /></view></view>
        </view>
      </view>
      <!-- 换岗位照片（V49）：已发的线下岗位整组换，最多 9 张，第一张做封面；点照片可以设为封面、往前挪、看大图或删掉。立即生效，不用重新审核 -->
      <view v-if="photoSheet" class="chip-pop cond-sheet photo-sheet">
        <view class="chip-pop__mask" @click="closePhotos" @touchmove.stop.prevent />
        <view class="chip-pop__panel">
          <view class="chip-pop__head" @touchmove.stop.prevent><text class="chip-pop__title">岗位照片</text><text class="chip-pop__hint cond-sheet__job">{{ photoSheet.title }}</text></view>
          <scroll-view scroll-y class="chip-pop__scroll cond-sheet__scroll">
            <view class="photo-grid"><view v-for="(url, i) in photoSheet.draft" :key="url" class="photo-cell" hover-class="k-press-s" @click="photoActions(photoSheet.draft, i)"><image class="photo-cell__img" :src="absUrl(url)" mode="aspectFill" /><text v-if="i === 0" class="photo-cell__cover">封面</text><view class="photo-cell__del" @click.stop="removePhoto(photoSheet.draft, i)"><k-icon name="x" :size="13" color="white" /></view></view><view v-if="photoSheet.draft.length < PHOTO_MAX" class="photo-cell photo-cell--add" hover-class="k-press-s" @click="addPhotos(photoSheet.draft)"><view class="photo-cell__add"><k-icon name="image-plus" :size="24" color="muted" /><text>{{ photoSheet.draft.length }}/{{ PHOTO_MAX }}</text></view></view></view>
            <text class="insurance-hint">{{ photoSheet.draft.length ? PHOTO_HINT : '还没有照片，用的是门店封面。' + PHOTO_HINT }}</text>
          </scroll-view>
          <view class="chip-pop__foot" @touchmove.stop.prevent><view class="chip-pop__btn"><k-button block type="secondary" label="取消" @click="closePhotos" /></view><view class="chip-pop__btn chip-pop__btn--main"><k-button block :label="photoSaving ? '保存中…' : '保存'" @click="savePhotos" /></view></view>
        </view>
      </view>
      <!-- 住宿与宠物（R2、R3、R4，V66）：已发的线下岗位补餐补、住宿照片视频、宠物，立即生效、不用重新审核。主人问的就是「换工的住宿视频在哪里上传」，老岗位在这里补。
           哪几块出现听服务端的（mealShown / housing / petShown）。合作商家上架后不能自己改（服务端同样拒绝），把关和换照片一样 -->
      <view v-if="extrasSheet" class="chip-pop cond-sheet extras-sheet">
        <view class="chip-pop__mask" @click="closeExtras" @touchmove.stop.prevent />
        <view class="chip-pop__panel">
          <view class="chip-pop__head" @touchmove.stop.prevent><text class="chip-pop__title">住宿与宠物</text><text class="chip-pop__hint cond-sheet__job">{{ extrasSheet.title }}</text></view>
          <scroll-view scroll-y class="chip-pop__scroll cond-sheet__scroll">
            <view v-if="extrasSheet.mealShown" class="extras-item">
              <view class="fc-label"><text class="fc-label__t">餐补</text></view>
              <view class="fc-money-row"><view class="fc-money" :class="{ 'fc-money--err': extrasErr }"><text class="fc-money__sign">¥</text><input class="fc-money__input" type="digit" :value="extrasSheet.draft.mealAllowance || ''" maxlength="8" placeholder="例如 30" placeholder-class="fc-ph" @input="extrasSheet.draft.mealAllowance = $event.detail.value" /></view><view class="fc-seg fc-seg--2"><view v-for="unitItem in MEAL_UNITS" :key="unitItem[1]" class="fc-seg__item" :class="{ on: extrasSheet.draft.mealAllowanceUnit === unitItem[1] }" hover-class="k-press" @click="extrasSheet.draft.mealAllowanceUnit = unitItem[1]"><text>{{ unitItem[0] }}</text></view></view></view>
              <text v-if="extrasErr" class="fc-err">{{ extrasErr }}</text>
            </view>
            <view v-if="extrasSheet.housing" class="extras-item">
              <view class="fc-label"><text class="fc-label__t">住宿照片或视频</text><text class="fc-count">照片 {{ extrasSheet.draft.lodgingImages.length }}/{{ PHOTO_MAX }} · 视频 {{ extrasSheet.draft.lodgingVideo ? 1 : 0 }}/1</text></view>
              <view class="fc-photos"><view v-for="(url, i) in extrasSheet.draft.lodgingImages" :key="url" class="fc-photo" hover-class="k-press-s" @click="photoActions(extrasSheet.draft.lodgingImages, i, false)"><image class="fc-photo__img" :src="absUrl(url)" mode="aspectFill" /><view class="fc-photo__del" hover-class="k-press" hover-stop-propagation @click.stop="removePhoto(extrasSheet.draft.lodgingImages, i)"><view class="fc-photo__x"><k-icon name="x" :size="13" color="white" :stroke="2.5" /></view></view></view><view v-if="extrasSheet.draft.lodgingImages.length < PHOTO_MAX" class="fc-photo" hover-class="k-press-s" @click="addPhotos(extrasSheet.draft.lodgingImages)"><view class="fc-photo__add"><k-icon name="plus" :size="24" color="ink2" :stroke="1.8" /><text>照片</text></view></view><view v-if="extrasSheet.draft.lodgingVideo" class="fc-photo" hover-class="k-press-s" @click="lodgingVideoActions(extrasSheet.draft)"><image v-if="extrasSheet.draft.lodgingVideoCover" class="fc-photo__img" :src="absUrl(extrasSheet.draft.lodgingVideoCover)" mode="aspectFill" /><view class="fc-photo__play"><k-icon name="play" :size="16" color="white" fill /></view><view class="fc-photo__del" hover-class="k-press" hover-stop-propagation @click.stop="removeLodgingVideo(extrasSheet.draft)"><view class="fc-photo__x"><k-icon name="x" :size="13" color="white" :stroke="2.5" /></view></view></view><view v-else class="fc-photo" hover-class="k-press-s" @click="addLodgingVideo(extrasSheet.draft)"><view class="fc-photo__add"><k-icon name="plus" :size="24" color="ink2" :stroke="1.8" /><text>视频</text></view></view></view>
              <text class="fc-note">{{ videoUploading ? VIDEO_BUSY_NOTE : VIDEO_NOTE }}</text>
            </view>
            <view v-if="extrasSheet.petShown" class="extras-item">
              <view class="fc-label"><text class="fc-label__t">店里有宠物吗</text></view>
              <view class="fc-seg fc-seg--2"><view v-for="petItem in PET_OPTS" :key="petItem[1]" class="fc-seg__item" :class="{ on: extrasSheet.draft.petStatus === petItem[1] }" hover-class="k-press" @click="setPet(extrasSheet.draft, petItem[1])"><text>{{ petItem[0] }}</text></view></view>
              <template v-if="extrasSheet.draft.petStatus === 'yes'">
                <view class="fc-label fc-label--sub"><text class="fc-label__t">宠物照片</text><text class="fc-count">{{ extrasSheet.draft.petImages.length }}/{{ PET_MAX }}</text></view>
                <view class="fc-photos"><view v-for="(url, i) in extrasSheet.draft.petImages" :key="url" class="fc-photo" hover-class="k-press-s" @click="photoActions(extrasSheet.draft.petImages, i, false)"><image class="fc-photo__img" :src="absUrl(url)" mode="aspectFill" /><view class="fc-photo__del" hover-class="k-press" hover-stop-propagation @click.stop="removePhoto(extrasSheet.draft.petImages, i)"><view class="fc-photo__x"><k-icon name="x" :size="13" color="white" :stroke="2.5" /></view></view></view><view v-if="extrasSheet.draft.petImages.length < PET_MAX" class="fc-photo" hover-class="k-press-s" @click="addPhotos(extrasSheet.draft.petImages, PET_MAX)"><view class="fc-photo__add"><k-icon name="plus" :size="24" color="ink2" :stroke="1.8" /><text>添加</text></view></view></view>
              </template>
            </view>
            <text class="fc-note extras-tip">保存后马上生效，不用重新审核。</text>
          </scroll-view>
          <view class="chip-pop__foot" @touchmove.stop.prevent><view class="fc-btn fc-btn--ghost" hover-class="k-press-s" @click="closeExtras"><text>取消</text></view><view class="fc-btn" hover-class="k-press-s" @click="saveExtras"><text>{{ extrasSaving ? '保存中…' : '保存' }}</text></view></view>
        </view>
      </view>
    </template>
    <template v-else-if="s===2">
      <k-topbar :title="formOpen ? (draftJob ? '完善商家岗位' : KIND_META[form.jobType].title) : '发布招募'" back custom-back :fab="!formOpen || !!submitted" @back="backFromPublish" />
      <!-- 发布入口（2026-10-18 商家端改版，E1）：四个板块 招募换工 / 招募兼职 / 招募全职 / 发布线上任务。
           前三个在本页填表，要填的就是用户端岗位详情页展示的东西；线上任务有自己的报酬、交付物、截止时间，去线上任务发布页填。
           流程不变：提交后落草稿，后台审核上架，通过后对用户公示（这句流程字只在注释里，页面上由成功页说） -->
      <view v-if="!formOpen && !submitted" class="pub-home k-pad-tab">
        <view class="pub-intro"><text class="pub-intro__title">你想招什么人？</text><text class="pub-intro__sub">{{ merchantStaff ? '选一个板块填好提交，袋鼠工作人员核实后上架' : '选一个板块填好提交，平台审核通过后用户就能看到' }}</text></view>
        <view class="pub-kinds">
          <view v-for="kind in publishKinds" :key="kind.key" class="pub-kind" :class="'pub-kind--' + kind.key" hover-class="k-press-s" @click="choosePublish(kind.key)">
            <view class="pub-kind__icon"><k-icon :name="kind.icon" :size="24" color="red" :stroke="1.8" /></view>
            <view class="pub-kind__copy"><text class="pub-kind__title">{{ kind.title }}</text><text class="pub-kind__sub">{{ kind.sub }}</text></view>
            <k-icon name="chevron-right" :size="18" color="muted" />
          </view>
        </view>
        <view class="pub-flow"><view v-for="(st, i) in FLOW_STEPS" :key="st" class="pub-flow__step"><text class="pub-flow__num">{{ i + 1 }}</text><text class="pub-flow__text">{{ st }}</text><k-icon v-if="i < FLOW_STEPS.length - 1" name="chevron-right" :size="13" color="light" /></view></view>
        <view class="pub-note"><k-icon name="store" :size="17" color="red" /><text>{{ STORE_NOTE }}</text></view>
      </view>
      <!-- 提交成功：说清楚接下来是平台审核，审核通过才对用户公示；可以回列表看「待平台审核」，也可以接着再发一个 -->
      <view v-else-if="submitted" class="pub-done k-pad-tab">
        <view class="pub-done__card">
          <view class="pub-done__icon"><k-icon name="check" :size="30" color="white" :stroke="2.6" /></view>
          <text class="pub-done__title">{{ submitted.message ? '已提交' : '已提交，等平台审核' }}</text>
          <text class="pub-done__sub">{{ submitted.message ? '「' + submitted.title + '」' + staffWording(submitted.message) + '；首页「我的需求」能看进度。' : '「' + submitted.title + '」已交给平台审核，通过后对用户公示；在岗位列表里能看到它的状态。' }}</text>
          <view class="pub-done__flow"><view v-for="(st, i) in FLOW_STEPS" :key="st" class="pub-done__step" :class="{ done: i === 0, now: i === 1 }"><view class="pub-done__dot"><k-icon v-if="i === 0" name="check" :size="12" color="white" :stroke="3" /></view><text>{{ st }}</text></view></view>
        </view>
        <view class="pub-done__actions"><view class="pub-btn pub-btn--ghost" hover-class="k-press-s" @click="doneToList"><text>{{ merchantStaff ? '回首页看进度' : '回岗位列表' }}</text></view><view class="pub-btn" hover-class="k-press-s" @click="publishAnother"><text>再发一个</text></view></view>
      </view>
      <!-- 填写屏（2026-10-31 R7 改版，主人：看起来很乱，用的人有年龄大的，要干净成熟）：一组一块通栏白底、选项是平的奶油色方块、选中整块实心棕、不常用的收进「更多设置」。
           字段一个没少；样式 form-clean.scss；字段名 16px、选项 15px、说明 14px，能点的高度不低于 44。字段的取舍见 DESIGN.md「填写页」。
           2026-11-03 主人：「优化界面，现在操作太繁琐了看不懂，增加一个预设模板，一键填写，我只要改一部分就行」：
           分三步——第 1 步选模板（job-templates.js，点一下全填好）→ 第 2 步必填信息 → 第 3 步时间和待遇（模板已选好，看一眼）；住宿照片、宠物、要求、福利都收进「更多设置（选填）」。
           看不懂的项下面一行小字说明；底部提交栏一直写着还差什么，不用等点了提交才知道。提交给服务端的内容一项没变 -->
      <view v-else class="fc-form">
        <!-- 第 1 步：模板。点一下改标题、工作内容、换工类型、工时、排班、期限、食宿、住宿条件、年龄、性格、技能、要求（兼职全职还有结算、薪资类型，全职还有门店类型、试用期、培训）；
             岗位照片、工作地点、到岗日期、招募人数、住宿照片视频、宠物、补贴奖金提成保险不动。填完收成一行，能撤销、能换一个。完善商家岗位时不出（商家写的不能一下被换掉） -->
        <view v-if="tplShown" class="fc-block">
          <text class="fc-group__title">第 1 步 · 选个模板</text>
          <view v-if="tplApplied && !tplOpen" class="tpl-done">
            <view class="tpl-done__copy"><text class="tpl-done__t">{{ tplApplied.label }}</text><text class="fc-note">改一改就能提交；照片、地点、日期没有动</text></view>
            <view class="tpl-done__act" hover-class="k-press" @click="undoTemplate"><text>撤销</text></view>
            <view class="tpl-done__act" hover-class="k-press" @click="tplOpen = true"><text>换一个</text></view>
          </view>
          <template v-else>
            <text class="fc-group__sub">点一下就帮你把标题、工作内容、排班、食宿、要求都填好，你只要改一改</text>
            <view class="tpl-grid">
              <view v-if="lastJob" class="tpl-card tpl-card--last" :class="{ on: tplApplied && tplApplied.key === LAST_KEY }" hover-class="k-press-s" @click="useLastJob"><text class="tpl-card__t">用上次的岗位</text><text class="tpl-card__s">{{ lastJob.title }}</text></view>
              <view v-for="tpl in tplList" :key="tpl.key" class="tpl-card" :class="{ on: tplApplied && tplApplied.key === tpl.key }" hover-class="k-press-s" @click="useTemplate(tpl)"><text class="tpl-card__t">{{ tpl.name }}</text><text class="tpl-card__s">{{ tpl.sub }}</text></view>
            </view>
          </template>
        </view>

        <!-- 第 2 步：必填信息（标题、照片、工作地点、工作内容；兼职、全职还有薪资）。底部提交栏写着还差哪几项 -->
        <view class="fc-block">
          <text class="fc-group__title">{{ stepTitles[0] }}</text>
          <view id="pf-title" class="fc-field">
            <view class="fc-label"><text class="fc-label__t">岗位标题</text><text class="fc-req">必填</text><text class="fc-count">{{ (gen.title || '').length }}/30</text></view>
            <input class="fc-input" :class="{ 'fc-input--err': err.title }" :value="gen.title || ''" maxlength="30" :placeholder="KIND_META[form.jobType].titleHint" placeholder-class="fc-ph" @input="setGen('title', $event.detail.value)" />
            <text v-if="err.title" class="fc-err">{{ err.title }}</text>
          </view>
          <!-- 岗位照片必填，至少一张，第一张做封面 -->
          <view id="pf-images" class="fc-field">
            <view class="fc-label"><text class="fc-label__t">岗位照片</text><text class="fc-req">必填</text><text class="fc-count">{{ form.images.length }}/{{ PHOTO_MAX }}</text></view>
            <view class="fc-photos"><view v-for="(url, i) in form.images" :key="url" class="fc-photo" hover-class="k-press-s" @click="photoActions(form.images, i)"><image class="fc-photo__img" :src="absUrl(url)" mode="aspectFill" /><text v-if="i === 0" class="fc-photo__tag">封面</text><view class="fc-photo__del" hover-class="k-press" hover-stop-propagation @click.stop="removePhoto(form.images, i)"><view class="fc-photo__x"><k-icon name="x" :size="13" color="white" :stroke="2.5" /></view></view></view><view v-if="form.images.length < PHOTO_MAX" class="fc-photo" hover-class="k-press-s" @click="addPhotos(form.images)"><view class="fc-photo__add"><k-icon name="plus" :size="24" color="ink2" :stroke="1.8" /><text>添加</text></view></view></view>
            <text v-if="err.images" class="fc-err">{{ err.images }}</text>
            <text v-else class="fc-note">拍店里、房间、干活的地方都行；第一张做封面，点照片可以换封面或删除</text>
          </view>
          <!-- 工作地点（V42）：不选就用门店地址；小程序里可以在地图上搜索选点，也能手填。手填没坐标时才多一句说明 -->
          <view id="pf-address" class="fc-row" :class="{ 'fc-row--err': err.address }" hover-class="k-press" @click="pickPlace"><view class="fc-row__copy"><view class="fc-row__head"><text class="fc-row__k">工作地点</text><text v-if="!storeAddress" class="fc-req">必填</text></view><text class="fc-row__long" :class="{ 'fc-row__long--empty': !form.address && !storeAddress }">{{ placeText }}</text><text v-if="placeTyped" class="fc-note">{{ placeHint }}</text><text v-if="err.address" class="fc-err">{{ err.address }}</text></view><k-icon name="chevron-right" :size="18" color="muted" /></view>
          <view id="pf-work" class="fc-field">
            <view class="fc-label"><text class="fc-label__t">工作内容</text><text class="fc-req">必填</text><view class="fc-act" hover-class="k-press" @click="generate"><text>{{ generating ? '正在写…' : '帮我起草' }}</text></view></view>
            <textarea v-if="editing === 'work'" class="fc-area" :value="gen.work || ''" maxlength="300" :placeholder="KIND_META[form.jobType].workHint" placeholder-class="fc-ph" :focus="true" auto-focus :show-confirm-bar="false" @input="setGen('work', $event.detail.value)" @blur="endEdit('work', $event)" />
            <view v-else class="fc-area fc-area--idle" :class="{ 'fc-area--err': err.work }" hover-class="k-press" @click="editing = 'work'"><text :class="{ 'fc-ph': !gen.work }">{{ gen.work || KIND_META[form.jobType].workHint }}</text></view>
            <text v-if="err.work" class="fc-err">{{ err.work }}</text>
            <view class="fc-foot"><text class="fc-note">每天做什么，一行写一件事</text><text class="fc-count">{{ (gen.work || '').length }}/300</text></view>
          </view>
          <!-- 兼职、全职的薪资必填（用户按日薪 / 月薪档位筛）；换工的补贴是选填，在「更多设置」里 -->
          <view v-if="form.jobType !== 'volunteer'" id="pf-salary" class="fc-field">
            <view class="fc-label"><text class="fc-label__t">薪资</text><text class="fc-req">必填</text></view>
            <view class="fc-seg fc-seg--4"><view v-for="o in SALARY_OPTIONS" :key="o.value" class="fc-seg__item" :class="{ on: form.salaryType === o.value }" hover-class="k-press" @click="form.salaryType = o.value"><text>{{ o.label }}</text></view></view>
            <view class="fc-gap"><view class="fc-money" :class="{ 'fc-money--err': err.salary }"><text class="fc-money__sign">¥</text><input class="fc-money__input" type="digit" :value="form.salary || ''" maxlength="9" :placeholder="'例如 ' + salaryOption(form.salaryType).example" placeholder-class="fc-ph" @input="form.salary = $event.detail.value" /><text class="fc-money__unit">{{ salaryOption(form.salaryType).unit }}</text></view></view>
            <text v-if="err.salary" class="fc-err">{{ err.salary }}</text>
            <text v-if="form.jobType === 'parttime' || form.jobType === 'fulltime'" class="fc-footnote">{{ form.jobType === 'fulltime' ? '平台从首月底薪中扣取 10%，同一次录用只收一次。' : '平台按实际工作日期，从每天工资中扣取 10%。' }}{{ recruitmentFeePreview }}</text>
            <text v-else class="fc-note">先选按小时 / 天 / 周 / 月算，再写金额；模板不替你写金额</text>
          </view>
        </view>

        <!-- 第 3 步：时间和待遇。都有默认或模板选好的值，看一眼对不对；看不懂的项下面一行小字 -->
        <view class="fc-block">
          <text class="fc-group__title">{{ stepTitles[1] }}</text>
          <!-- 换工类型（后台「字典管理 → 换工类型」可改）：只有换工岗位要选，不选也能发布；选项和说明在底部弹层里 -->
          <view v-if="form.jobType==='volunteer' && kindOptions.length" class="fc-row" hover-class="k-press" @click="openSheet('workKind')"><view class="fc-row__copy"><text class="fc-row__k">换工类型</text><text class="fc-note">用户在「换宿旅行」按类型找岗位</text></view><text class="fc-row__v" :class="{ 'fc-row__v--empty': !workKindLabel }">{{ workKindLabel || '请选择' }}</text><k-icon name="chevron-right" :size="18" color="muted" /></view>
          <!-- 门店类型（全职）：用户在「全职旅行」按 民宿 / 酒店 / 咖啡餐饮 / 酒吧 筛选；选了会写成岗位的第一个标签 -->
          <view v-if="form.jobType==='fulltime'" class="fc-row" hover-class="k-press" @click="openSheet('category')"><view class="fc-row__copy"><text class="fc-row__k">门店类型</text><text class="fc-note">用户按门店类型找岗位</text></view><text class="fc-row__v" :class="{ 'fc-row__v--empty': !categoryLabel }">{{ categoryLabel || '请选择' }}</text><k-icon name="chevron-right" :size="18" color="muted" /></view>
          <view id="pf-startDate" class="fc-row" :class="{ 'fc-row--err': err.startDate }" hover-class="k-press" @click="startCalendar = true"><view class="fc-row__copy"><text class="fc-row__k">到岗日期</text><text v-if="err.startDate" class="fc-err">{{ err.startDate }}</text><text v-else class="fc-note">最早哪天能来</text></view><text class="fc-row__v" :class="{ 'fc-row__v--empty': !startDateText }">{{ startDateText || '请选择' }}</text><k-icon name="chevron-right" :size="18" color="muted" /></view>
          <view class="fc-row" hover-class="k-press" @click="openSheet('minDays')"><view class="fc-row__copy"><text class="fc-row__k">最短期限</text><text class="fc-note">来了至少要待多久</text></view><text class="fc-row__v">{{ minDaysLabel }}</text><k-icon name="chevron-right" :size="18" color="muted" /></view>
          <view id="pf-genderCounts" class="fc-row"><text class="fc-row__k">招募人数</text><text v-if="form.genderCountsEnabled" class="fc-row__v">合计 {{ form.headcount }} 人</text><view v-else class="fc-stepper"><view class="fc-stepper__btn" hover-class="k-press" @click="stepHead(-1)"><k-icon name="minus" :size="20" :color="form.headcount <= 1 ? 'light' : 'ink'" /></view><text class="fc-stepper__num">{{ form.headcount }} 人</text><view class="fc-stepper__btn" hover-class="k-press" @click="stepHead(1)"><k-icon name="plus" :size="20" :color="form.headcount >= 99 ? 'light' : 'ink'" /></view></view></view>
          <view v-if="form.jobType === 'volunteer'" class="fc-field gender-plan">
            <view class="fc-label"><text class="fc-label__t">招募性别</text></view>
            <view class="fc-seg gender-plan__modes">
              <view v-for="option in RECRUIT_GENDERS" :key="option[1]" class="fc-seg__item" :class="{ on: genderMode === option[1] }" hover-class="k-press" @click="chooseGenderMode(option[1])"><text>{{ option[0] }}</text></view>
            </view>
            <view v-if="form.genderCountsEnabled" class="gender-plan__counts">
              <view class="gender-plan__count"><text>男生</text><input class="gender-plan__input" type="number" :value="form.genderMaleCount" maxlength="2" placeholder="0" aria-label="男生招募人数" @input="setGenderCount('genderMaleCount', $event.detail.value)" /><text>人</text></view>
              <view class="gender-plan__count"><text>女生</text><input class="gender-plan__input" type="number" :value="form.genderFemaleCount" maxlength="2" placeholder="0" aria-label="女生招募人数" @input="setGenderCount('genderFemaleCount', $event.detail.value)" /><text>人</text></view>
            </view>
            <text v-if="err.genderCounts" class="fc-err">{{ err.genderCounts }}</text>
            <text v-else-if="form.genderCountsEnabled" class="fc-note">分别填写计划招募人数，不招请填 0；总人数自动合计</text>
          </view>
          <!-- R1 每日工时：只留 2、4、6、8 小时。老岗位存的别的值（弹性时间、每天 10 小时）哪格都不亮，下面照实写一句；不点就原样提交，点了才换 -->
          <view class="fc-field">
            <view class="fc-label"><text class="fc-label__t">每日工时</text></view>
            <view class="fc-seg fc-seg--4"><view v-for="h in HOUR_OPTS" :key="h[1]" class="fc-seg__item" :class="{ on: form.dailyHours === h[1] }" hover-class="k-press" @click="pickDailyHours(h[1])"><text>{{ h[0] }}</text></view></view>
            <text v-if="legacyHours" class="fc-note">目前存的是「{{ legacyHours }}」，不选就保持不变</text>
          </view>
          <view class="fc-row" hover-class="k-press" @click="openSheet('restMode')"><view class="fc-row__copy"><text class="fc-row__k">休息排班</text><text class="fc-note">比如做五休二：干 5 天休 2 天</text></view><text class="fc-row__v" :class="{ 'fc-row__v--empty': !restLabel }">{{ restLabel || '请选择' }}</text><k-icon name="chevron-right" :size="18" color="muted" /></view>
          <view v-if="form.jobType !== 'volunteer'" class="fc-field">
            <view class="fc-label"><text class="fc-label__t">结算方式</text></view>
            <view class="fc-seg fc-seg--4"><view v-for="st in SETTLE_OPTS" :key="st" class="fc-seg__item" :class="{ on: form.settleDesc === st }" hover-class="k-press" @click="form.settleDesc = form.settleDesc === st ? '' : st"><text>{{ st }}</text></view></view>
            <text class="fc-note">工钱多久结一次，再点一下取消</text>
          </view>
          <view class="fc-field">
            <view class="fc-label"><text class="fc-label__t">食宿</text></view>
            <view class="fc-seg" :class="boardOptions.length === 2 ? 'fc-seg--2' : 'fc-seg--4'"><view v-for="b in boardOptions" :key="b[1]" class="fc-seg__item" :class="{ on: boardOf(form) === b[1] }" hover-class="k-press" @click="setBoard(b[1])"><text>{{ b[0] }}</text></view></view>
            <text v-if="form.jobType === 'volunteer'" class="fc-note">换宿换的就是住宿，所以至少要包住</text>
          </view>
          <!-- R2 餐补：只要不包吃就出现（只包住 / 包住 / 不包食宿），选填；用户端岗位详情看得到 -->
          <view v-if="mealShown" id="pf-meal" class="fc-field">
            <view class="fc-label"><text class="fc-label__t">餐补</text></view>
            <view class="fc-money-row"><view class="fc-money" :class="{ 'fc-money--err': err.meal }"><text class="fc-money__sign">¥</text><input class="fc-money__input" type="digit" :value="form.mealAllowance || ''" maxlength="8" placeholder="例如 30" placeholder-class="fc-ph" @input="form.mealAllowance = $event.detail.value" /></view><view class="fc-seg fc-seg--2"><view v-for="unitItem in MEAL_UNITS" :key="unitItem[1]" class="fc-seg__item" :class="{ on: form.mealAllowanceUnit === unitItem[1] }" hover-class="k-press" @click="form.mealAllowanceUnit = unitItem[1]"><text>{{ unitItem[0] }}</text></view></view></view>
            <text v-if="err.meal" class="fc-err">{{ err.meal }}</text>
            <text v-else class="fc-note">不包吃时补多少饭钱，没有就空着</text>
          </view>
          <!-- 住宿条件（V48）：包住的岗位才填；用户按房型筛选时只看写明了房型的岗位 -->
          <view v-if="housing" class="fc-field">
            <view class="fc-label"><text class="fc-label__t">住宿条件</text></view>
            <view class="fc-seg fc-seg--4"><view v-for="roomItem in ROOM_TYPES" :key="roomItem[1]" class="fc-seg__item" :class="{ on: form.roomType===roomItem[1] }" hover-class="k-press" @click="form.roomType = form.roomType === roomItem[1] ? '' : roomItem[1]"><text>{{ roomItem[0] }}</text></view></view>
            <text class="fc-note">来了住几人间</text>
          </view>
        </view>
        <text v-if="filterNote" class="fc-footnote">{{ filterNote }}</text>

        <!-- 更多设置（选填）：新发布默认收起；打开时里面已有内容（完善商家岗位）就默认展开。提交报错绝不藏住：折叠区有错自动展开并滚过去，又手动收起时头上写红字。
             2026-11-03 住宿照片视频、宠物也收进来（都是选填，第一次发布看着太长） -->
        <view class="fc-block">
          <view class="fc-more" :class="{ 'fc-more--open': moreOpen }" hover-class="k-press" @click="moreOpen = !moreOpen">
            <view class="fc-more__copy"><text class="fc-more__t">更多设置<text class="fc-more__n">（选填，{{ moreCount }} 项{{ moreFilled ? '，已填 ' + moreFilled + ' 项' : '' }}）</text></text><text v-if="!moreOpen && foldErrText" class="fc-more__sum fc-more__sum--err">{{ foldErrText }}</text><text v-else-if="!moreOpen" class="fc-more__sum">{{ moreSummary }}</text></view>
            <view class="fc-more__act"><text>{{ moreOpen ? '收起' : '展开' }}</text><k-icon :name="moreOpen ? 'chevron-up' : 'chevron-down'" :size="18" color="#8A5E36" /></view>
          </view>
          <view v-if="moreOpen">
            <!-- R4 住宿照片或视频：包住才有，最多 9 张照片、1 段视频（小院视频规则 3 分钟、200MB），都选填 -->
            <view v-if="housing" class="fc-field">
              <view class="fc-label"><text class="fc-label__t">住宿照片或视频</text><text class="fc-count">照片 {{ form.lodgingImages.length }}/{{ PHOTO_MAX }} · 视频 {{ form.lodgingVideo ? 1 : 0 }}/1</text></view>
              <view class="fc-photos"><view v-for="(url, i) in form.lodgingImages" :key="url" class="fc-photo" hover-class="k-press-s" @click="photoActions(form.lodgingImages, i, false)"><image class="fc-photo__img" :src="absUrl(url)" mode="aspectFill" /><view class="fc-photo__del" hover-class="k-press" hover-stop-propagation @click.stop="removePhoto(form.lodgingImages, i)"><view class="fc-photo__x"><k-icon name="x" :size="13" color="white" :stroke="2.5" /></view></view></view><view v-if="form.lodgingImages.length < PHOTO_MAX" class="fc-photo" hover-class="k-press-s" @click="addPhotos(form.lodgingImages)"><view class="fc-photo__add"><k-icon name="plus" :size="24" color="ink2" :stroke="1.8" /><text>照片</text></view></view><view v-if="form.lodgingVideo" class="fc-photo" hover-class="k-press-s" @click="lodgingVideoActions(form)"><image v-if="form.lodgingVideoCover" class="fc-photo__img" :src="absUrl(form.lodgingVideoCover)" mode="aspectFill" /><view class="fc-photo__play"><k-icon name="play" :size="16" color="white" fill /></view><view class="fc-photo__del" hover-class="k-press" hover-stop-propagation @click.stop="removeLodgingVideo(form)"><view class="fc-photo__x"><k-icon name="x" :size="13" color="white" :stroke="2.5" /></view></view></view><view v-else class="fc-photo" hover-class="k-press-s" @click="addLodgingVideo(form)"><view class="fc-photo__add"><k-icon name="plus" :size="24" color="ink2" :stroke="1.8" /><text>视频</text></view></view></view>
              <text class="fc-note">{{ videoUploading ? VIDEO_BUSY_NOTE : VIDEO_NOTE }}</text>
            </view>
            <!-- R3 宠物：只给招募换工。都不选 = 没填，不挡提交；选「有」才出现传照片，最多 6 张，也是选填 -->
            <view v-if="form.jobType==='volunteer'" class="fc-field">
              <view class="fc-label"><text class="fc-label__t">店里有宠物吗</text></view>
              <view class="fc-seg fc-seg--2"><view v-for="petItem in PET_OPTS" :key="petItem[1]" class="fc-seg__item" :class="{ on: form.petStatus === petItem[1] }" hover-class="k-press" @click="setPet(form, petItem[1])"><text>{{ petItem[0] }}</text></view></view>
              <template v-if="form.petStatus === 'yes'">
                <view class="fc-label fc-label--sub"><text class="fc-label__t">宠物照片</text><text class="fc-count">{{ form.petImages.length }}/{{ PET_MAX }}</text></view>
                <view class="fc-photos"><view v-for="(url, i) in form.petImages" :key="url" class="fc-photo" hover-class="k-press-s" @click="photoActions(form.petImages, i, false)"><image class="fc-photo__img" :src="absUrl(url)" mode="aspectFill" /><view class="fc-photo__del" hover-class="k-press" hover-stop-propagation @click.stop="removePhoto(form.petImages, i)"><view class="fc-photo__x"><k-icon name="x" :size="13" color="white" :stroke="2.5" /></view></view></view><view v-if="form.petImages.length < PET_MAX" class="fc-photo" hover-class="k-press-s" @click="addPhotos(form.petImages, PET_MAX)"><view class="fc-photo__add"><k-icon name="plus" :size="24" color="ink2" :stroke="1.8" /><text>添加</text></view></view></view>
              </template>
            </view>
            <view class="fc-row" hover-class="k-press" @click="openSheet('age')"><text class="fc-row__k">年龄</text><text class="fc-row__v">{{ form.age || '不限' }}</text><k-icon name="chevron-right" :size="18" color="muted" /></view>
            <!-- 2026-11-03 主人：「加一个性格」。年龄段、性格的选项都在电脑后台「袋鼠小院 → 岗位要求选项」里配；性格最多选 3 个 -->
            <view class="fc-row" hover-class="k-press" @click="openSheet('personality')"><text class="fc-row__k">性格</text><text class="fc-row__v" :class="{ 'fc-row__v--empty': !form.personality.length }">{{ form.personality.length ? form.personality.join('、') : '可不选，最多 ' + reqOptions.personalityMax + ' 个' }}</text><k-icon name="chevron-right" :size="18" color="muted" /></view>
            <view class="fc-row" hover-class="k-press" @click="openSheet('keywords')"><text class="fc-row__k">技能 / 关键词</text><text class="fc-row__v" :class="{ 'fc-row__v--empty': !form.keywords.length }">{{ form.keywords.length ? form.keywords.join('、') : '请选择，最多 4 个' }}</text><k-icon name="chevron-right" :size="18" color="muted" /></view>
            <view id="pf-hope" class="fc-field">
              <view class="fc-label"><text class="fc-label__t">其他要求</text></view>
              <textarea v-if="editing === 'hope'" class="fc-area fc-area--short" :value="gen.hope || ''" maxlength="300" :placeholder="KIND_META[form.jobType].hopeHint" placeholder-class="fc-ph" :focus="true" auto-focus :show-confirm-bar="false" @input="setGen('hope', $event.detail.value)" @blur="endEdit('hope', $event)" />
              <view v-else class="fc-area fc-area--short fc-area--idle" :class="{ 'fc-area--err': err.hope }" hover-class="k-press" @click="editing = 'hope'"><text :class="{ 'fc-ph': !gen.hope }">{{ gen.hope || KIND_META[form.jobType].hopeHint }}</text></view>
              <text v-if="err.hope" class="fc-err">{{ err.hope }}</text>
              <view class="fc-foot"><text class="fc-note">一行写一条</text><text class="fc-count">{{ (gen.hope || '').length }}/300</text></view>
            </view>
            <view class="fc-field">
              <view class="fc-label"><text class="fc-label__t">上班时段</text></view>
              <input class="fc-input" :value="form.shiftTime" maxlength="32" placeholder="例如：9:00-12:00，15:00-18:00" placeholder-class="fc-ph" @input="form.shiftTime = $event.detail.value" />
            </view>
            <view v-if="boardOf(form) !== 'none'" class="fc-field">
              <view class="fc-label"><text class="fc-label__t">食宿说明</text></view>
              <input class="fc-input" :value="form.boardDesc" maxlength="60" placeholder="例如：独立单间，三餐和店里一起" placeholder-class="fc-ph" @input="form.boardDesc = $event.detail.value" />
            </view>
            <!-- 换宿的补贴是选填的开关 -->
            <template v-if="form.jobType==='volunteer'">
              <view class="fc-row" :class="{ 'fc-row--open': form.salaryEnabled }" hover-class="k-press" @click="toggleSalary"><text class="fc-row__k">另有补贴</text><view class="fc-switch" :class="{ on: form.salaryEnabled }"><view class="fc-switch__dot" /></view></view>
              <view v-if="form.salaryEnabled" id="pf-salary" class="fc-sub">
                <view class="fc-seg fc-seg--4"><view v-for="o in SALARY_OPTIONS" :key="o.value" class="fc-seg__item" :class="{ on: form.salaryType === o.value }" hover-class="k-press" @click="form.salaryType = o.value"><text>{{ o.label }}</text></view></view>
                <view class="fc-gap"><view class="fc-money" :class="{ 'fc-money--err': err.salary }"><text class="fc-money__sign">¥</text><input class="fc-money__input" type="digit" :value="form.salary || ''" maxlength="9" :placeholder="'例如 ' + salaryOption(form.salaryType).example" placeholder-class="fc-ph" @input="form.salary = $event.detail.value" /><text class="fc-money__unit">{{ salaryOption(form.salaryType).unit }}</text></view></view>
                <text v-if="err.salary" class="fc-err">{{ err.salary }}</text>
              </view>
            </template>
            <template v-if="form.jobType === 'fulltime'">
              <view class="fc-field">
                <view class="fc-label"><text class="fc-label__t">试用期</text></view>
                <view class="fc-seg fc-seg--4"><view v-for="pr in PROBATION_OPTS" :key="pr" class="fc-seg__item" :class="{ on: form.probation === pr }" hover-class="k-press" @click="form.probation = form.probation === pr ? '' : pr"><text>{{ pr }}</text></view></view>
              </view>
              <view class="fc-field">
                <view class="fc-label"><text class="fc-label__t">培训</text></view>
                <input class="fc-input" :value="form.trainDesc" maxlength="64" placeholder="例如：入职带薪培训 3 天，有师傅带" placeholder-class="fc-ph" @input="form.trainDesc = $event.detail.value" />
              </view>
            </template>
            <!-- 福利：满月红包（V44，只是标记）、奖金、提成；保险（为录用人员安排）；安心商家认证由门店统一提供 -->
            <view class="fc-row" hover-class="k-press" @click="toggleRedpacket"><text class="fc-row__k">做满一个月有红包</text><view class="fc-switch" :class="{ on: form.monthRedpacket }"><view class="fc-switch__dot" /></view></view>
            <view class="fc-row" :class="{ 'fc-row--open': form.bonusEnabled }" hover-class="k-press" @click="form.bonusEnabled = !form.bonusEnabled"><text class="fc-row__k">奖金</text><view class="fc-switch" :class="{ on: form.bonusEnabled }"><view class="fc-switch__dot" /></view></view>
            <view v-if="form.bonusEnabled" id="pf-bonus" class="fc-sub">
              <textarea v-if="editing === 'bonusDesc'" class="fc-area fc-area--short" :value="form.bonusDesc" maxlength="120" placeholder="比如做满 30 天奖励 500 元；写清怎么算、什么时候发" placeholder-class="fc-ph" :focus="true" auto-focus :show-confirm-bar="false" @input="form.bonusDesc = $event.detail.value" @blur="endEdit('bonusDesc', $event)" />
              <view v-else class="fc-area fc-area--short fc-area--idle" :class="{ 'fc-area--err': err.bonus }" hover-class="k-press" @click="editing = 'bonusDesc'"><text :class="{ 'fc-ph': !form.bonusDesc }">{{ form.bonusDesc || '比如做满 30 天奖励 500 元；写清怎么算、什么时候发' }}</text></view>
              <text v-if="err.bonus" class="fc-err">{{ err.bonus }}</text>
            </view>
            <view class="fc-row" :class="{ 'fc-row--open': form.commissionEnabled }" hover-class="k-press" @click="form.commissionEnabled = !form.commissionEnabled"><text class="fc-row__k">提成</text><view class="fc-switch" :class="{ on: form.commissionEnabled }"><view class="fc-switch__dot" /></view></view>
            <view v-if="form.commissionEnabled" id="pf-commission" class="fc-sub">
              <textarea v-if="editing === 'commissionDesc'" class="fc-area fc-area--short" :value="form.commissionDesc" maxlength="120" placeholder="比如按个人销售额的 5%；写清怎么提、什么时候结" placeholder-class="fc-ph" :focus="true" auto-focus :show-confirm-bar="false" @input="form.commissionDesc = $event.detail.value" @blur="endEdit('commissionDesc', $event)" />
              <view v-else class="fc-area fc-area--short fc-area--idle" :class="{ 'fc-area--err': err.commission }" hover-class="k-press" @click="editing = 'commissionDesc'"><text :class="{ 'fc-ph': !form.commissionDesc }">{{ form.commissionDesc || '比如按个人销售额的 5%；写清怎么提、什么时候结' }}</text></view>
              <text v-if="err.commission" class="fc-err">{{ err.commission }}</text>
            </view>
            <view class="fc-row" :class="{ 'fc-row--open': form.insuranceFlag === '0' }" hover-class="k-press" @click="toggleInsurance"><text class="fc-row__k">为录用人员安排保险</text><view class="fc-switch" :class="{ on: form.insuranceFlag === '0' }"><view class="fc-switch__dot" /></view></view>
            <!-- 本店商家可进入保险申请；审核出单仍由服务端校验权限。安心商家认证保留原角色限制。 -->
            <view v-if="form.insuranceFlag === '0'" class="fc-sub"><view class="fc-foot"><text class="fc-note">录用后按人办理，以实际保单为准</text><view class="fc-act" hover-class="k-press" @click="goInsurance"><text>保险管理</text></view></view></view>
            <view v-if="!merchantStaff" class="fc-row" hover-class="k-press" @click="showCertification"><text class="fc-row__k">安心商家认证</text><text class="fc-row__v fc-row__v--plain">{{ storeCert ? '已认证' : '未认证' }}</text><k-icon name="chevron-right" :size="18" color="muted" /></view>
          </view>
        </view>

        <!-- 门店级资料不在发布表里填（r5 起在电脑后台「门店资料」，袋鼠员工统一填），这里一句说明 -->
        <merchant-agreement v-if="merchantStaff && !draftJob" ref="merchantAgreement" :store-id="currentStaffStoreId()" :type="form.jobType" />
        <merchant-agreement v-if="merchantStaff && !draftJob && form.jobType === 'volunteer'" ref="volunteerNotice" :store-id="currentStaffStoreId()" type="volunteer_notice" />
        <text class="fc-footnote">{{ STORE_NOTE }}</text>
      </view>
      <!-- 底部操作条只放按钮，流程怎么走提交成功页会说（2026-11-03 起点「提交」不再弹确认框）。按钮上面一行一直写着还差什么（2026-11-03 主人嫌提交了才报错），点了标红并滚到第一项；都填好了写一句可以提交 -->
      <view v-if="formOpen && !submitted && draftJob" class="fc-bar">
        <view class="fc-bar__todo" :class="{ 'fc-bar__todo--err': errCount, 'fc-bar__todo--ok': !todoKeys.length }" hover-class="k-press" @click="showTodo"><text>{{ todoText }}</text></view>
        <view class="fc-bar__btns"><view class="fc-btn" hover-class="k-press-s" @click="submitJob"><text>保存</text></view></view>
      </view>
      <view v-else-if="formOpen && !submitted" class="fc-bar">
        <view class="fc-bar__todo" :class="{ 'fc-bar__todo--err': errCount, 'fc-bar__todo--ok': !todoKeys.length }" hover-class="k-press" @click="showTodo"><text>{{ todoText }}</text></view>
        <view class="fc-bar__btns"><fc-kefu /><view class="fc-btn" hover-class="k-press-s" @click="submitJob"><text>{{ merchantStaff ? '提交' : '提交审核' }}</text></view></view>
      </view>
      <k-tabbar v-if="!formOpen || submitted" mode="staff" active="work" />
      <k-date-picker v-if="startCalendar" title="到岗日期" :value="form.startDate || todayCn()" :min-date="todayCn()" @cancel="startCalendar = false" @confirm="confirmStartDate" />
      <fc-sheet v-if="sheetConf" :title="sheetConf.title" :options="sheetConf.options" :value="sheetConf.value" :multiple="sheetConf.multiple" :max="sheetConf.max" :empty-label="sheetConf.emptyLabel" :custom-label="sheetConf.customLabel" :custom-title="sheetConf.customTitle" :custom-hint="sheetConf.customHint" :custom-max="sheetConf.customMax" @confirm="confirmSheet" @cancel="sheetKey = ''" />
    </template>
    <template v-else>
      <k-topbar title="分享追踪" back custom-back @back="backFromShare" />
      <view class="share-page k-pad-tab">
        <view class="share-card"><text class="share-title">岗位链接</text><view class="link-row"><text class="link-text">{{ share.link || linkHint }}</text><button @click="copyLink"><text>复制</text></button></view><view class="share-poster"><text class="share-title">分享海报</text><view><image :src="absUrl(share.cover) || '/static/media/cover-empty.png'" mode="aspectFill" /><view><text>{{ share.title || '' }}</text><text>{{ share.summary || '' }}</text></view><button @click="savePoster"><text>保存海报</text></button></view></view></view>
        <!-- 2026-11-03 主人：简化商家端。按换工主理人 / 员工 / 渠道的追踪表和员工分享榜是内部看的，合作商家只留链接 + 海报 -->
        <template v-if="!merchantStaff">
        <text class="track-title">追踪维度</text><view class="track-tabs"><text :class="{active:dim==='manager'}" @click="setDim('manager')">按换工主理人</text><text :class="{active:dim==='staff'}" @click="setDim('staff')">按员工</text><text :class="{active:dim==='channel'}" @click="setDim('channel')">按渠道</text></view>
        <view class="data-title"><text>{{ dimTitle }}（近30天）</text><text>· 数据更新：{{ stats.updatedAt || '' }}</text></view>
        <view class="data-table"><view class="thead"><text>{{ dimHead }}</text><text>访问</text><text>报名</text><text>通过</text><text>转化率</text></view><view v-for="r in channelRows" :key="r.name"><text>{{r.name}}</text><text>{{r.visit}}</text><text>{{r.apply}}</text><text>{{r.pass}}</text><text>{{r.rate}}</text></view><view class="total"><text>合计</text><text>{{ statTotal.visit }}</text><text>{{ statTotal.apply }}</text><text>{{ statTotal.pass }}</text><text>{{ statTotal.rate }}</text></view></view>
        <text class="rank-title">员工分享榜 TOP5</text><view class="rank-card"><view class="rank-head"><text></text><text>分享</text><text>报名</text><text>通过</text></view><view v-for="(r,i) in ranks" :key="r.name"><text class="rank-name"><text class="rank-num">{{i+1}}</text>　{{r.name}}（ID: {{r.id}}）</text><text>{{r.share}}</text><text>{{r.apply}}</text><text>{{r.pass}}</text></view></view><text class="full-rank" @click="showAllRanks">查看完整榜单 〉</text>
        </template>
      </view><k-tabbar mode="staff" active="work" />
    </template>
  </view>
  </k-feature-gate>
</template>

<script setup>
// ---------------------------------------------------------------------------
// 岗位管理（员工端）接入情况：
//   s=1 列表与指标：apiStaffJobs（类型页签、关键词、状态筛选）；点卡片可分享、暂停/恢复、调整名额；
//       "批量管理" = 批量暂停 / 恢复当前列表里的岗位
//   s=2 发布招募（2026-10-18 商家端改版）：四个板块 招募换工 / 招募兼职 / 招募全职 / 发布线上任务；前三个在本页填一张分组表单，
//       要填的就是用户端岗位详情页展示的东西；「帮我起草」调 apiStaffDescribeJob（规则模板，未调用外部 AI 服务）起草标题和工作内容。
//       2026-11-03 表单顶上加了预设模板（job-templates.js，一键填写）和「用上次的岗位」，底部提交栏一直写着还差什么。
//       线上任务去 online-jobs.vue 的发布页（报酬、交付物、截止时间、验收标准）。之前的第 3 屏「生成描述」已并进表单，老链接 ?s=3 落到这一屏
//   s=4 分享追踪：分享码按"员工 × 岗位 × 渠道"生成；访问按访客按天去重，报名与通过按分享码归因。
//       复制链接 / 保存海报 / 右上角转发会各记一次分享。海报在本机绘制，暂不含小程序码（需接入微信服务端接口）
// 员工提交的新岗位落为草稿，平台后台审核通过后才对用户可见。
// ---------------------------------------------------------------------------
import { absUrl, chooseImages, uploadTo } from '@/common/upload.js'
import { ref, computed, watch } from 'vue'
import { onShareAppMessage, onShow, onHide, onUnload } from '@dcloudio/uni-app'
import { useScreen, toast, go, back } from '@/common/screen.js'
import {
  apiStaffJobs, apiStaffJobKeywords, apiStaffDescribeJob, apiStaffCreateJob, apiStaffBatchJobs,
  apiStaffShareJob, apiStaffShareStats, apiJobKinds
} from '@/common/api.js'
import { ensureSession, hasStaffAccess, currentStaffStoreId, merchantStaff, selectStaffStore, staffStoreUrl } from '@/common/experience.js'
import { errText, confirm, alert, prompt, sheet, copy, isYmd, shiftDate, todayCn } from '@/common/ui.js'
import { savePosterImage } from '@/common/poster.js'
import { genderPlanPayload, genderPlanError, genderCountText } from '@/common/job-gender.js'
import { validateSalaryForm, salaryPayload, jobBenefits, parseSalaryAmount, SALARY_OPTIONS, salaryOption } from '@/common/job-salary.js'
import { staffCan } from '@/common/staff-perms.js'
import { post, put } from '@/common/request.js'
import { get } from '@/common/request.js'
import { MERCHANT_JOBS_API, draftJobForm } from './request-view.js'
import { templatesOf, applyTemplate, mergeLastJob, undoPatch } from './job-templates.js'
import { chooseAndUploadVideo, uploadVideoParts, previewVideo as playVideoFull } from './stay-video.js'
import FcSheet from './components/fc-sheet.vue'
import FcKefu from './components/fc-kefu.vue'
import MerchantAgreement from './components/merchant-agreement.vue'
const merchantAgreement = ref(null), volunteerNotice = ref(null)
import R from '@/common/routes.js'

// 打开本页时落在哪一屏：直接打开分享追踪（?s=4）的，返回回来源页
let entryScreen = 1
const s = useScreen(4, {
  onLoad: (q) => {
    entryScreen = Number(q?.s) || 1
    // 第 3 屏「生成描述」已并进发布表单：老链接 ?s=3 落到发布入口
    if (entryScreen === 3) { entryScreen = 2; s.value = 2 }
    // 工作台「发布招募」直接点某一类（?s=2&kind=volunteer）：权限取回来后直接打开那张表
    entryKind = entryScreen === 2 && KIND_META[q?.kind] ? q.kind : ''
    enterLinkedStore(q?.storeId).then(loadJobs).then(() => { if (entryKind && s.value === 2 && !formOpen.value) choosePublish(entryKind) })
  }
})
// 派单消息点进来带着门店（/pages/staff/jobs?storeId=…，V63）：先切到那家商家店，列表和权限才是那家店的。切不过去就留在当前门店，说一声
async function enterLinkedStore(target) {
  if (target == null || target === '') return
  try {
    await ensureSession()
    if (String(target) !== String(currentStaffStoreId())) await selectStaffStore(target)
  } catch (e) {
    toast(errText(e, '切换门店失败'))
  }
}
// 之前从卡片去「调整名额 / 紧急招募」「交付与结算」等页面处理完返回，列表还是旧的人数和状态（本页没有 onShow）。
// 现在回到列表屏时重取一次；第一次显示由 onLoad 取，不重复请求
let shownOnce = false
onShow(() => { if (shownOnce && s.value === 1) loadJobs(); shownOnce = true; lockPageScroll(listSheetOpen()) })

// ---------------- s=1 列表 ----------------
const type = ref('')
const keyword = ref('')
const statusFilter = ref('')
// 2026-11-03 主人：统一叫法——合作商家看到的岗位状态「待审核」叫「待完善」（草稿是袋鼠工作人员在完善，不是商家等审核）；员工自己看的还是「待审核」。按身份切换，值不变
const STATUS_OPTS = computed(() => [
  { v: '', l: '全部状态' }, { v: 'recruiting', l: '招聘中' }, { v: 'short', l: '缺人中' },
  { v: 'paused', l: '已暂停' }, { v: 'draft', l: merchantStaff.value ? '待完善' : '待审核' }, { v: 'closed', l: '已关闭' }
])
const statusFilterLabel = computed(() => (statusFilter.value ? (STATUS_OPTS.value.find(o => o.v === statusFilter.value) || {}).l : '筛选'))
const metrics = ref([
  { label: '全部岗位', value: 0, tone: '' }, { label: '招聘中', value: 0, tone: '' },
  { label: '缺人中', value: 0, tone: 'amber-text' }, { label: '已暂停', value: 0, tone: '' }
])
const rows = ref([])
const storeCert = ref(false)
const canEdit = ref(false)
// 门店地址：发布页「工作地点」不选时写「默认：门店地址 …」；门店登记过坐标的，不选点也会带上门店的点
const storeAddress = ref('')
const storeHasPoint = ref(false)
// 模板沿用设计稿字段：status 显示中文状态，原始状态留在 rawStatus
// 封面：后台上传的是 /profile/... 相对路径，之前原样当图片地址，小程序里显示空白；与用户端岗位列表一样用 absUrl 补全
// 2026-11-03 主人：简化商家端文案。合作商家看到的「换工主理人 / 商家服务人 / 城市负责人」统一叫「袋鼠工作人员」（服务端给的状态字也一并换），员工自己看的不动。
// 和 merchant-request-logic.js 的 staffWording 同一条规则（这里不引：沙箱测试里没给的导入会变成永远不返回的函数）
const staffWording = (t) => String(t == null ? '' : t).replace(/换工主理人|商家服务人|城市负责人/g, '袋鼠工作人员')
// 2026-11-03 主人：统一叫法——服务端给商家的岗位状态字「待审核」显示成「待完善」（和上面筛选项一致）
const merchantJobStatus = (t) => staffWording(t).replace(/待审核/g, '待完善')
const jobList = computed(() => rows.value.map(r => ({ ...r, img: absUrl(r.img), status: merchantStaff.value ? merchantJobStatus(r.statusLabel) : r.statusLabel, rawStatus: r.status })))

async function loadJobs() {
  await ensureSession()
  if (!hasStaffAccess.value) return
  try {
    const res = await apiStaffJobs({
      storeId: currentStaffStoreId(),
      type: type.value || undefined,
      keyword: keyword.value || undefined,
      status: statusFilter.value || undefined
    })
    const data = res.data || {}
    metrics.value = data.metrics || metrics.value
    rows.value = data.rows || []
    storeCert.value = !!data.storeCert
    canEdit.value = !!data.canEdit
    storeAddress.value = data.storeAddress || ''
    storeHasPoint.value = !!pointOf({ latitude: data.storeLatitude, longitude: data.storeLongitude })
    // 合作商家不补筛选条件（2026-11-03 主人：简化，这页只留状态、报名数和三个按钮）：顶上的「去补填」提示不出
    missingCount.value = merchantStaff.value ? 0 : (Number(data.conditionsMissingCount) || 0)
    missingJob.value = merchantStaff.value ? null : (data.conditionsMissingJob || null)
  } catch (e) {
    toast(errText(e, '岗位加载失败'))
  }
}
const setType = (t) => { type.value = t; loadJobs() }
// 派给换工主理人的商家岗位（V63）：服务端给 canPublish 的草稿能在这里完善、上架、不通过；普通草稿仍只能后台上架
const draftRows = computed(() => jobList.value.filter(r => r.canPublish))
const askKeyword = async () => {
  const v = await prompt('搜索岗位', { value: keyword.value, placeholder: '岗位 / 关键词 / 地点 / 编号' })
  if (v === null) return
  keyword.value = v
  loadJobs()
}
const pickStatus = async () => {
  const i = await sheet(STATUS_OPTS.value.map(o => o.l))
  if (i < 0) return
  statusFilter.value = STATUS_OPTS.value[i].v
  loadJobs()
}

// 暂停 / 恢复：网络慢时连点会重复提交
let batching = false
async function runBatch(ids, action) {
  if (batching) return
  batching = true
  try {
    const res = await apiStaffBatchJobs(currentStaffStoreId(), ids, action)
    toast(res.msg || '已处理')
    loadJobs()
  } catch (e) {
    toast(errText(e, '操作失败'))
  } finally {
    batching = false
  }
}
async function batchManage() {
  if (!canEdit.value) return toast('当前角色没有岗位编辑权限')
  const published = rows.value.filter(r => r.status === 'published').map(r => r.jobId)
  const paused = rows.value.filter(r => r.status === 'paused').map(r => r.jobId)
  const opts = [`暂停列表中 ${published.length} 个招聘中的岗位`, `恢复列表中 ${paused.length} 个已暂停的岗位`]
  const i = await sheet(opts)
  if (i < 0) return
  const ids = i === 0 ? published : paused
  if (!ids.length) return toast('没有可操作的岗位')
  if (!(await confirm('批量管理', opts[i] + '？'))) return
  runBatch(ids, i === 0 ? 'pause' : 'resume')
}
// ---------------- 合作商家的卡片（2026-11-03 主人：简化商家端） ----------------
// 原来点卡片弹 5–6 项菜单（分享与追踪 / 暂停 / 改地点 / 补条件 / 换照片 / 住宿与宠物 / 调整名额 / 查看详情），「调整名额 / 紧急招募」还会跳到商家没权限的派单页被弹回首页。
// 现在：分享 / 暂停 / 恢复三个大按钮按状态直接摆在卡片上（1 步），点卡片本身看岗位详情；待上架的只写一句「袋鼠工作人员正在完善，上架后通知你」。员工端（jobActions）不变
const MERCHANT_DRAFT_TIP = '袋鼠工作人员正在完善，上架后通知你'
const merchantActs = (j) => {
  const canToggle = canEdit.value && staffCan('jobs', 'edit')
  const acts = []
  if (j.rawStatus === 'published' || j.rawStatus === 'paused') acts.push('分享')
  if (j.rawStatus === 'published' && canToggle) acts.push('暂停')
  if (j.rawStatus === 'paused' && canToggle) acts.push('恢复')
  return acts
}
function merchantAct(j, a) {
  if (a === '分享') return openShare(j)
  if (a === '暂停') return runBatch([j.jobId], 'pause')
  if (a === '恢复') return runBatch([j.jobId], 'resume')
}
function merchantTap(j) {
  if (j.rawStatus === 'published' || j.rawStatus === 'paused') return go('/pages/jobs/detail?jobId=' + j.jobId)
  toast(j.rawStatus === 'draft' ? MERCHANT_DRAFT_TIP : '岗位关闭后无法再操作')
}
const cardTap = (j) => (merchantStaff.value ? merchantTap(j) : jobActions(j))
async function jobActions(j) {
  if (merchantStaff.value) return merchantTap(j)
  const live = j.rawStatus === 'published' || j.rawStatus === 'paused'
  const acts = []
  if (j.canPublish) acts.push(DRAFT_PUBLISH, DRAFT_EDIT, DRAFT_CLOSE)
  // 线上任务：接单人的成果验收与线下结算在「线上任务」页处理
  if (j.jobType === 'online') acts.push('交付与结算')
  if (live) acts.push('分享与追踪')
  // 暂停 / 恢复走的是和「批量管理」同一个接口，服务端要「岗位管理·编辑」；没有权限的角色不出这两项
  const canToggle = canEdit.value && staffCan('jobs', 'edit')
  if (j.rawStatus === 'published' && canToggle) acts.push('暂停招聘')
  if (j.rawStatus === 'paused' && canToggle) acts.push('恢复招聘')
  // 改工作地点（V42）：店长、管家（岗位管理·编辑）改本店线下岗位，立即生效、不用重新审核；线上任务是远程交付，没有工作地点
  if (canToggle && j.jobType !== 'online' && ['draft', 'published', 'paused'].includes(j.rawStatus)) acts.push('修改工作地点')
  // 补填筛选条件（10-16 跟进）、换岗位照片（V49）：同一把关（岗位管理·编辑、本店线下岗位、没关闭），立即生效、不用重新审核
  if (canToggle && condEditable(j)) acts.push(COND_ACTION)
  // 合作商家上架后不能自己换照片（服务端同样拒绝）：自助开通的商家换图不经过任何人，由换工主理人换
  if (canToggle && condEditable(j) && !(merchantStaff.value && j.rawStatus !== 'draft')) acts.push(PHOTO_ACTION)
  // 住宿与宠物（R4）：老岗位在这里补住宿视频、照片和餐补、宠物；把关和换照片一样（服务端同样拒绝合作商家上架后自己改）
  if (canToggle && condEditable(j) && !(merchantStaff.value && j.rawStatus !== 'draft')) acts.push(EXTRAS_ACTION)
  if (live) acts.push('调整名额 / 紧急招募')
  if (live) acts.push('查看岗位详情')
  if (!acts.length) return toast(j.rawStatus === 'draft' ? '岗位待平台审核，上架后可分享' : '该岗位已关闭')
  // 系统菜单一页最多 6 项（多了要翻页）：放不下时把改地点 / 补条件 / 换照片收成一项，点了再选
  const edits = acts.filter(x => EDIT_ACTIONS.includes(x))
  const menu = acts.length > 6 && edits.length > 1 ? acts.filter(x => !EDIT_ACTIONS.includes(x) || x === edits[0]).map(x => (x === edits[0] ? EDIT_MORE : x)) : acts
  const i = await sheet(menu)
  if (i < 0) return
  let a = menu[i]
  if (a === EDIT_MORE) {
    const k = await sheet(edits)
    if (k < 0) return
    a = edits[k]
  }
  if (a === DRAFT_PUBLISH) return publishDraft(j)
  if (a === DRAFT_EDIT) return editDraft(j)
  if (a === DRAFT_CLOSE) return closeDraft(j)
  if (a === '交付与结算') return go(R.staffOnline + '?jobId=' + j.jobId)
  if (a === '分享与追踪') return openShare(j)
  if (a === '暂停招聘') return runBatch([j.jobId], 'pause')
  if (a === '恢复招聘') return runBatch([j.jobId], 'resume')
  if (a === '修改工作地点') return movePlace(j)
  if (a === COND_ACTION) return openConditions(j)
  if (a === PHOTO_ACTION) return openPhotos(j)
  if (a === EXTRAS_ACTION) return openExtras(j)
  if (a === '调整名额 / 紧急招募') return go('/pages/staff/dispatch?s=2&jobId=' + j.jobId)
  go('/pages/jobs/detail?jobId=' + j.jobId)
}

// ---------------- 商家岗位：完善、上架、不通过（V63） ----------------
// 服务端按岗位所属门店核对：必须是这家店的换工主理人，岗位还在派单中；上架走和后台一样的校验，通过后通知商家和城市负责人
const DRAFT_PUBLISH = '上架', DRAFT_EDIT = '完善岗位信息', DRAFT_CLOSE = '不通过'
// draftJob：正在完善的那条（{ jobId, title }），发布表单这时是「保存修改」；draftBefore：打开时的内容，没改就不问
const draftJob = ref(null)
let draftBefore = ''
let draftBusy = false
const draftSnapshot = () => JSON.stringify([form.value, gen.value])
async function publishDraft(j) {
  if (draftBusy) return
  if (!(await confirm('上架岗位', `「${j.title}」上架后用户就能看到并报名，商家也会收到通知。确认上架？`)) || draftBusy) return
  draftBusy = true
  try {
    const res = await post(MERCHANT_JOBS_API + '/' + j.jobId + '/publish')
    toast(res.msg || '已上架')
  } catch (e) {
    toast(errText(e, '上架失败'))
  } finally {
    draftBusy = false
  }
  // 失败也刷新：可能别的换工主理人刚处理过，或者后台刚上架
  loadJobs()
}
async function closeDraft(j) {
  if (draftBusy) return
  const reason = await prompt('不通过的原因（会发给商家）', { placeholder: '例如：工作内容不清楚，请补充后重新发布' })
  if (reason === null) return
  if (!reason) return toast('请填写不通过的原因')
  if (reason.length > 200) return toast('原因最多 200 字')
  if (draftBusy) return
  draftBusy = true
  try {
    const res = await post(MERCHANT_JOBS_API + '/' + j.jobId + '/close', { reason })
    toast(res.msg || '已关闭并通知商家')
  } catch (e) {
    toast(errText(e, '操作失败'))
  } finally {
    draftBusy = false
  }
  loadJobs()
}
async function editDraft(j) {
  if (draftBusy) return
  draftBusy = true
  try {
    const d = (await get(MERCHANT_JOBS_API + '/' + j.jobId)).data || {}
    if (!d.canEdit || !d.job) { toast('这个商家岗位已经处理过了'); loadJobs(); return }
    const next = draftJobForm(d.job, newForm(d.job.jobType), { categories: CATEGORY_OPTS, storeAddress: storeAddress.value })
    form.value = next.form
    gen.value = next.gen
    tried.value = false
    editing.value = ''
    submitted.value = null
    sheetKey.value = ''
    // 折叠区里已经有内容就默认展开，不让人以为东西丢了；老工时记下来，点错了再点一下能回到它
    moreOpen.value = moreFilledOf(next.form, next.gen) > 0
    hoursBefore.value = legacyHoursOf(next.form.dailyHours)
    resetTemplate()
    draftJob.value = { jobId: j.jobId, title: j.title }
    draftBefore = draftSnapshot()
    formOpen.value = true
    s.value = 2
    loadKindOptions()
    loadKeywordOptions()
    loadReqOptions()
    if (typeof uni !== 'undefined' && uni.pageScrollTo) uni.pageScrollTo({ scrollTop: 0, duration: 0 })
  } catch (e) {
    toast(errText(e, '岗位读取失败'))
  } finally {
    draftBusy = false
  }
}
function leaveDraft() {
  draftJob.value = null
  formOpen.value = false
  form.value = newForm()
  gen.value = {}
  tried.value = false
  editing.value = ''
  sheetKey.value = ''
  moreOpen.value = false
  hoursBefore.value = ''
  resetTemplate()
  s.value = 1
}
async function saveDraft(f) {
  const job = draftJob.value
  const res = await put(MERCHANT_JOBS_API + '/' + job.jobId, jobPayload(f, String(gen.value.title || '').trim()))
  toast(res.msg || '已保存')
  leaveDraft()
  await loadJobs()
  publishDraft({ jobId: job.jobId, title: (res.data && res.data.title) || job.title })
}

// ---------------- s=2 发布（2026-10-18 商家端改版，E1） ----------------
// 发布入口改成四个板块：招募换工 / 招募兼职 / 招募全职 / 发布线上任务。前三个在本页填一张表，要填的 = 用户端岗位详情页展示的东西
// （pages/jobs/detail.vue + store-page.js）：标题、换工类型 / 门店类型、照片、地点、到岗日期、最短期限、人数、性别（只换宿）、年龄、技能、其他要求、
// 工作内容、每日工时、休息排班、上班时段、食宿、住宿条件、食宿说明、薪资（兼职 / 全职必填，换宿是选填的补贴）、结算方式、试用期 / 培训（全职）、
// 满月红包、奖金、提成、保险。门店级资料（店长、采访视频、亮点、交通、营业执照、店里日常）袋鼠员工在电脑后台「门店资料」里填，表里只给一行说明。
// 线上任务的报酬、交付物、截止时间、验收标准、素材都在线上任务那一套里（online-jobs.vue ?s=1），选它直接过去。
// 标题、工作内容、其他要求放在 gen 里（之前是第 3 屏「生成描述」的结果，现在直接在表里写）：「帮我起草」调同一个描述接口，只填空着的几项。
// 流程不变：提交 → 落草稿（待平台审核）→ 后台审核上架 → 用户可见
const KIND_LIST = [
  { key: 'volunteer', title: '招募换工', icon: 'heart-handshake', sub: '换宿旅行：店里包住，用每天几小时帮忙换食宿' },
  { key: 'parttime', title: '招募兼职', icon: 'briefcase', sub: '兼职旅行：按天或按小时算工钱，边旅行边打工' },
  { key: 'fulltime', title: '招募全职', icon: 'briefcase-business', sub: '全职旅行：按月发工资，长期在店里工作' },
  { key: 'online', title: '发布线上任务', icon: 'laptop', sub: '远程完成：写作、设计、剪辑等，验收后结算报酬' }
]
// 每一类的标题和输入提示（提示里的例子只是写法示范，不会被提交）
const KIND_META = {
  volunteer: { title: '招募换工', icon: 'heart-handshake', titleHint: '例如：洱海边民宿前台换工',
    workHint: '例如：\n帮客人办理入住、退房\n打理公共区域和小花园\n周末一起组织篝火晚会', hopeHint: '例如：\n喜欢和人打交道\n能按约定待满时间' },
  parttime: { title: '招募兼职', icon: 'briefcase', titleHint: '例如：古城咖啡店周末兼职',
    workHint: '例如：\n吧台出品咖啡和饮品\n收银、整理座位', hopeHint: '例如：\n有咖啡店工作经验优先\n周末两天都能到岗' },
  fulltime: { title: '招募全职', icon: 'briefcase-business', titleHint: '例如：海边民宿店长',
    workHint: '例如：\n负责民宿日常运营和排房\n带换工完成接待和打扫', hopeHint: '例如：\n有 1 年以上民宿或酒店经验\n能长期在店' }
}
// 2026-11-03 主人：简化商家端文案。商家看到的进度条是「已提交 → 袋鼠核实中 → 已上架」（和首页「我发布的」里的进度同一套说法），不提换工主理人；员工的不动
const FLOW_STEPS = computed(() => merchantStaff.value ? ['已提交', '袋鼠核实中', '已上架'] : ['填写信息', '平台审核', '通过后公示'])
const STORE_NOTE = '店长介绍、采访视频、该店亮点、交通参考、营业执照、店里日常属于门店资料，由袋鼠员工在电脑后台「门店资料」里统一填写，这里不用填。'
// 每日工时：兼职、全职、换宿默认不一样（可以改，也可以不填）
const DEFAULT_HOURS = { volunteer: '每天 4 小时', parttime: '每天 6 小时', fulltime: '每天 8 小时' }
// R1 主人原话「工作时间:2小时，四小时，六小时，八小时（别出现十小时）」：只留这四个。服务端不校验取值（老版本还在提交每天 10 小时，不能拒），选项只在这里收
const HOUR_OPTS = [['2 小时', '每天 2 小时'], ['4 小时', '每天 4 小时'], ['6 小时', '每天 6 小时'], ['8 小时', '每天 8 小时']]
// 年龄、性格写进要求的前两行（用户端「换工要求 / 岗位要求」一条条列出来），不单独存。
// 2026-11-03 主人：「年龄选择年龄段，在后台管理配置」「加一个性格」：选项从服务端取（后台「袋鼠小院 → 岗位要求选项」，V67），
// 老服务端没有这个接口、或者没取到时用下面这组（和 V67 的种子一样）。「不限」= 不写年龄这一行
const REQ_FALLBACK = {
  ages: ['不限', '18-25岁', '18-30岁', '18-35岁', '18-40岁', '18岁以上'],
  personalities: ['活泼开朗', '细心耐心', '善于沟通', '吃苦耐劳', '有责任心', '安静内向也欢迎'],
  personalityMax: 3
}
const SETTLE_OPTS = ['日结', '周结', '月结', '离店结算']
const PROBATION_OPTS = ['无试用期', '1个月', '2个月', '3个月']
// 门店类型（全职，和用户端「全职旅行 → 类型」同一组代码，见 JobTabFilters.CATEGORIES）
const CATEGORY_OPTS = [['民宿', 'homestay'], ['酒店', 'hotel'], ['咖啡餐饮', 'food'], ['酒吧', 'bar'], ['其他', 'other']]
const newForm = (kind = 'volunteer') => ({
  jobType: kind, startDate: shiftDate(todayCn(), 7),
  // 食宿 / 薪资的默认：都先选包吃包住；换宿不发补贴，兼职默认日薪、全职默认月薪（必填：用户按日薪 / 月薪档位筛）
  boardType: 'all', boardEnabled: true, boardDesc: '',
  pay: kind === 'volunteer' ? 'board' : 'salary', salaryEnabled: kind !== 'volunteer', salaryType: kind === 'fulltime' ? 'monthly' : 'daily', salary: '',
  bonusEnabled: false, bonusDesc: '', commissionEnabled: false, commissionDesc: '', insuranceFlag: '1',
  monthRedpacket: false, headcount: 2, keywords: [], workKind: '',
  // V48 选填：性别偏好（只换宿，'' 男女不限 / F 女 / M 男）、休息排班（'5-2' 这类）、住宿条件（包住才有）、最短在店天数（null = 不限）
  genderPref: '', genderCountsEnabled: false, genderMaleCount: null, genderFemaleCount: null, restMode: '', roomType: '', minDays: null,
  // E1 新增：每日工时、上班时段、年龄（写进要求）、结算方式；全职的试用期、培训、门店类型
  dailyHours: DEFAULT_HOURS[kind] || '', shiftTime: '', age: '', settleDesc: '', probation: '', trainDesc: '', category: '',
  // 2026-11-03：性格（最多 3 个，写进要求的「性格：」一行）
  personality: [],
  // 工作地点：都空着 = 用门店地址；地图选点时三项一起有；手填只有地址（坐标清空）
  address: '', latitude: null, longitude: null,
  // 岗位照片（V49）：已上传的平台图片路径，最多 9 张，第一张做封面；空 = 用门店封面
  images: [],
  // V66 选填：餐补（不包吃才有，金额 + 元/天 或 元/月）、宠物（只给换工，'' 没填 / none 没有 / yes 有，有才带照片）、住宿照片和视频（包住才有）
  mealAllowance: '', mealAllowanceUnit: 'day', petStatus: '', petImages: [], lodgingImages: [], lodgingVideo: '', lodgingVideoCover: ''
})
const recruitmentFeePreview = computed(() => {
  const value = Number(form.value.salary)
  if (!Number.isFinite(value) || value <= 0) return ''
  if (form.value.jobType === 'fulltime' && form.value.salaryType !== 'monthly') return ' 首月底薪需在结算时另行确认。'
  if (form.value.jobType === 'parttime' && form.value.salaryType !== 'daily') return ' 结算时按每天实际工资计算。'
  const base = Math.round(value * 100), fee = Math.floor((base + 5) / 10)
  return ` 预计服务费 ¥${(fee / 100).toFixed(2)}，扣后实得 ¥${((base - fee) / 100).toFixed(2)}。`
})
const form = ref(newForm())
// 标题、工作内容、其他要求（之前是第 3 屏「生成描述」的结果，名字沿用 gen）
const gen = ref({})
// formOpen：在填表（false = 四个板块的入口）；submitted：刚提交成功的那个（{ title, jobId }），显示「已提交，等平台审核」
const formOpen = ref(false)
const submitted = ref(null)
// 从工作台「发布招募」直接点某一类进来的（?s=2&kind=volunteer）：表单左上角返回回来源页
let entryKind = ''
const publishKinds = computed(() => KIND_LIST.filter(k => k.key !== 'online' || staffCan('online', 'edit')))
const startPublish = () => {
  if (!canEdit.value) return toast('当前门店身份没有岗位发布权限')
  formOpen.value = false
  submitted.value = null
  s.value = 2
}
function choosePublish(kind) {
  if (kind === 'online') return staffCan('online', 'edit') ? go(R.staffOnline + '?s=1') : toast('当前角色没有线上任务发布权限')
  if (!KIND_META[kind]) return
  if (!canEdit.value) return toast('当前门店身份没有岗位发布权限')
  form.value = newForm(kind)
  gen.value = {}
  tried.value = false
  editing.value = ''
  submitted.value = null
  sheetKey.value = ''
  moreOpen.value = false
  hoursBefore.value = ''
  resetTemplate()
  formOpen.value = true
  loadKindOptions()
  loadKeywordOptions()
  loadReqOptions()
  loadLastJob(kind)
  if (typeof uni !== 'undefined' && uni.pageScrollTo) uni.pageScrollTo({ scrollTop: 0, duration: 0 })
}
// 填了东西再返回：问一句（表单不存草稿，返回就没了）
const formDirty = () => JSON.stringify(form.value) !== JSON.stringify(newForm(form.value.jobType)) || ['title', 'work', 'hope'].some(k => String(gen.value[k] || '').trim())
async function backFromPublish() {
  // 底部弹层开着时系统返回只收起弹层
  if (sheetKey.value) { sheetKey.value = ''; return }
  if (draftJob.value) {
    if (draftSnapshot() !== draftBefore && !(await confirm('先不改了？', '这次改的内容不会保存。'))) return
    leaveDraft()
    return
  }
  if (formOpen.value && !submitted.value) {
    if (formDirty() && !(await confirm('先不发了？', '已经填的内容不会保存。'))) return
    editing.value = ''
    formOpen.value = false
    if (entryKind) { entryKind = ''; back() }
    return
  }
  submitted.value = null
  if (entryScreen === 2) return back()
  s.value = 1
}
const doneToList = () => { if (merchantStaff.value) return uni.reLaunch({ url: R.staff }); submitted.value = null; formOpen.value = false; s.value = 1; loadJobs() }
const publishAnother = () => { submitted.value = null; formOpen.value = false; entryKind = '' }
// 到岗日期用日历选（之前要手敲 yyyy-MM-dd）
const startCalendar = ref(false)
const confirmStartDate = (date) => {
  startCalendar.value = false
  if (date) form.value.startDate = date
}
const RECRUIT_GENDERS = [['男女不限', ''], ['只招男生', 'M'], ['只招女生', 'F'], ['分别设置', 'split']]
const genderMode = computed(() => form.value.genderCountsEnabled ? 'split' : form.value.genderPref)
function chooseGenderMode(mode) {
  const f = form.value
  if (mode === 'split' && !f.genderCountsEnabled) {
    const total = Math.max(1, Number(f.headcount) || 1)
    f.genderMaleCount = f.genderPref === 'F' ? 0 : f.genderPref === 'M' ? total : Math.ceil(total / 2)
    f.genderFemaleCount = total - f.genderMaleCount
  }
  f.genderCountsEnabled = mode === 'split'
  f.genderPref = f.genderCountsEnabled ? genderPlanPayload(f).genderPref : mode
  if (!f.genderCountsEnabled) f.headcount = Math.min(99, Math.max(1, Number(f.headcount) || 1))
}
function setGenderCount(key, value) {
  const f = form.value
  f[key] = value
  const plan = genderPlanPayload(f)
  f.headcount = plan.headcount
  f.genderPref = plan.genderPref
}
const stepHead = (n) => { form.value.headcount = Math.min(99, Math.max(1, form.value.headcount + n)) }

// 文字项：标题、工作内容、其他要求在 gen 里；奖金、提成规则在 form 里。
// 小程序的 textarea 是原生层、盖在页面最上面（连底部的提交栏也压住）：不在输入时换成同样外观的 view，点了才换回输入框（和 k-job-salary 同一个做法）
const editing = ref('')
const GEN_KEYS = ['title', 'work', 'hope']
const setGen = (key, v) => { gen.value = { ...gen.value, [key]: v } }
function endEdit(key, e) {
  const v = e && e.detail ? e.detail.value : undefined
  if (v !== undefined) {
    if (GEN_KEYS.includes(key)) setGen(key, v)
    else form.value[key] = v
  }
  if (editing.value === key) editing.value = ''
}

// 每日工时：四格一点就选（再点取消）。老岗位存的别的值（弹性时间、每天 10 小时）不算选项：哪格都不亮，下面照实写一句，不点就原样提交，点了才换。
// hoursBefore：打开表单时的老值，点错了再点一下回到它，不是清空（这才不算悄悄改掉）
const legacyHoursOf = (v) => (v && !HOUR_OPTS.some(h => h[1] === v) ? v : '')
const legacyHours = computed(() => legacyHoursOf(form.value.dailyHours))
const hoursBefore = ref('')
function pickDailyHours(v) {
  form.value.dailyHours = form.value.dailyHours === v ? hoursBefore.value : v
}
// 取值的显示：存的还是原来的值，只改显示
const startDateText = computed(() => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(form.value.startDate || ''))
  return m ? `${m[1]}年${Number(m[2])}月${Number(m[3])}日` : ''
})
const optLabel = (opts, v) => (opts.find(o => o[1] === v) || [])[0] || ''
const categoryLabel = computed(() => optLabel(CATEGORY_OPTS, form.value.category))
const restLabel = computed(() => optLabel(REST_MODES, form.value.restMode))
// 老岗位的最短期限可能不是这几档（比如 10 天）：照实写，不算没填
const minDaysLabel = computed(() => optLabel(MIN_DAY_OPTS, form.value.minDays || null) || form.value.minDays + ' 天')
const workKindLabel = computed(() => (kindOptions.value.find(k => k.value === form.value.workKind) || {}).label || '')

// ---------------- 底部弹层（选项超过 4 个、多选，components/fc-sheet.vue） ----------------
// 一次只开一个，sheetKey 就是要改的那个 form 字段
const sheetKey = ref('')
const asOption = (o) => ({ label: o[0], value: o[1] })
const openSheet = (key) => { editing.value = ''; sheetKey.value = key }
const sheetConf = computed(() => {
  const k = sheetKey.value, f = form.value
  if (k === 'workKind') return { title: '换工类型', emptyLabel: '不选', value: f.workKind, options: kindOptions.value.map(o => ({ label: o.label, value: o.value, desc: o.desc })) }
  if (k === 'category') return { title: '门店类型', emptyLabel: '不选', value: f.category, options: CATEGORY_OPTS.map(asOption) }
  if (k === 'minDays') return { title: '最短期限（至少待多久）', value: f.minDays, options: MIN_DAY_OPTS.map(asOption) }
  if (k === 'restMode') return { title: '休息排班', emptyLabel: '不选', value: f.restMode, options: REST_MODES.map(asOption) }
  if (k === 'age') return ageSheet(f.age)
  if (k === 'personality') return { title: '性格（最多 ' + reqOptions.value.personalityMax + ' 个）', multiple: true, max: reqOptions.value.personalityMax, value: f.personality || [], options: reqOptions.value.personalities.map(w => ({ label: w, value: w })) }
  if (k === 'keywords') return { title: '技能 / 关键词', multiple: true, max: 4, value: f.keywords, options: skillChips.value.map(w => ({ label: w, value: w })), customLabel: '＋ 自己写一个', customTitle: '自定义技能 / 关键词', customHint: '不超过 8 个字', customMax: 8 }
  return null
})
function confirmSheet(v) {
  const k = sheetKey.value
  sheetKey.value = ''
  if (k) form.value[k] = v
}

// ---------------- 更多选填（折叠） ----------------
// 新发布默认收起；打开时里面已有内容（完善商家岗位）就默认展开。折叠内容用 v-if，值都在 form / gen 里，收起不丢
const moreOpen = ref(false)
const moreCount = computed(() => {
  const f = form.value
  // 年龄、性格、技能、其他要求、上班时段、红包、奖金、提成、保险、认证一直有；不包食宿时没有食宿说明。
  // 2026-11-03 住宿照片视频（包住才有）、宠物（只给换工）也收进来；合作商家不出「安心商家认证」那一行（主人：简化）
  return 10 - (merchantStaff.value ? 1 : 0) + (boardOf(f) !== 'none' ? 1 : 0) + (housingOf(f) ? 1 : 0) + (f.jobType === 'volunteer' ? 2 : 0) + (f.jobType === 'fulltime' ? 2 : 0)
})
const MORE_SUMMARY = { volunteer: '住宿照片、宠物、年龄、性格、技能、红包、奖金、保险等', parttime: '年龄、性格、技能、住宿照片、红包、奖金、提成、保险等', fulltime: '年龄、性格、技能、试用期、培训、住宿照片、红包、保险等' }
const moreSummary = computed(() => MORE_SUMMARY[form.value.jobType] || '')
const filledText = (v) => !!String(v || '').trim()
const moreFilledOf = (f, g) => [
  f.age, (f.personality || []).length, (f.keywords || []).length, filledText(g.hope), filledText(f.shiftTime),
  boardOf(f) !== 'none' && filledText(f.boardDesc), f.jobType === 'volunteer' && f.salaryEnabled,
  f.jobType === 'fulltime' && f.probation, f.jobType === 'fulltime' && filledText(f.trainDesc),
  f.monthRedpacket, f.bonusEnabled, f.commissionEnabled, f.insuranceFlag === '0',
  housingOf(f) && ((f.lodgingImages || []).length || f.lodgingVideo), f.jobType === 'volunteer' && f.petStatus
].filter(Boolean).length
const moreFilled = computed(() => moreFilledOf(form.value, gen.value))

// 食宿：换宿只能 包吃包住 / 只包住（换的就是住宿）；兼职、全职 包吃包住 / 包住 / 包吃 / 不包食宿（和用户端「食宿」筛选同一组代码）
const BOARD_VOLUNTEER = [['包吃包住', 'all'], ['只包住', 'room']]
const BOARD_ALL = [['包吃包住', 'all'], ['包住', 'room'], ['包吃', 'meal'], ['不包食宿', 'none']]
const boardOptions = computed(() => (form.value.jobType === 'volunteer' ? BOARD_VOLUNTEER : BOARD_ALL))
/** 当前的食宿代码：新表单看 boardType；补填条件弹层、老数据只有 boardEnabled 时按它算 all / none */
const boardOf = (f) => (f.boardType ? f.boardType : (jobBenefits(f).boardEnabled ? 'all' : 'none'))
function setBoard(b) {
  const f = form.value
  f.boardType = b
  f.boardEnabled = b !== 'none'
  f.pay = f.salaryEnabled ? 'salary' : f.boardEnabled ? 'board' : 'none'
  // 不包住了就没有房型（服务端也会清掉，这里先清，免得页面上还亮着）。住宿照片和视频留着（传一次不容易，切回来还在），提交时不包住就不带
  if (!housingOf(f)) f.roomType = ''
  // 包吃了就没有餐补（R2）
  if (!mealOn(f)) f.mealAllowance = ''
}
// 换宿的补贴是选填的开关；兼职、全职的薪资必填，没有开关
function toggleSalary() {
  const f = form.value
  if (f.jobType !== 'volunteer') return
  f.salaryEnabled = !f.salaryEnabled
  f.pay = f.salaryEnabled ? 'salary' : f.boardEnabled ? 'board' : 'none'
}

// ---------------- V48 选填条件：性别偏好 / 休息排班 / 住宿条件 / 最短在店 ----------------
// 取值和后端约定一致（KgStaffJobService 按白名单校验，超出范围的存成空），和岗位列表筛选面板里的选项是同一组
const GENDER_OPTS = [['男女不限', ''], ['女', 'F'], ['男', 'M']]
const REST_MODES = [['做一休一', '1-1'], ['做四休三', '4-3'], ['做二休一', '2-1'], ['做五休二', '5-2'], ['做三休二', '3-2'], ['做三休一', '3-1'], ['做六休一', '6-1']]
const ROOM_TYPES = [['单人间', 'single'], ['双人间', 'double'], ['三人间', 'triple'], ['多人间', 'multi']]
const MIN_DAY_OPTS = [['不限', null], ['一周', 7], ['半个月', 15], ['20天', 20], ['一个月', 30]]
// 包住：换宿旅行（换的就是住宿），或食宿选了包吃包住 / 包住；线上任务不在店里干活，没有住宿
const housingOf = (f) => f.jobType !== 'online' && (f.jobType === 'volunteer' || ['all', 'room'].includes(boardOf(f)))
const housing = computed(() => housingOf(form.value))
// 餐补（R2，主人拍板）：只要不包吃就出现，即 只包住 / 包住 / 不包食宿；包吃包住、包吃没有。和服务端 JobExtras 同一条
const mealOn = (f) => f.jobType !== 'online' && ['room', 'none'].includes(boardOf(f))
const mealShown = computed(() => mealOn(form.value))
const MEAL_UNITS = [['元/天', 'day'], ['元/月', 'month']]
/** 和服务端同一条规则，就地提示；空着不算错（选填） */
const mealError = (text) => {
  const t = String(text || '').trim()
  if (!t) return ''
  if (!/^\d{1,5}(\.\d{1,2})?$/.test(t)) return '餐补金额要是数字，最多两位小数'
  return Number(t) > 0 ? '' : '餐补金额要大于 0'
}
// 宠物（R3）：只给招募换工，都不选 = 没填，再点取消；选「有」才传照片，最多 6 张，也是选填
const PET_OPTS = [['没有', 'none'], ['有', 'yes']]
const PET_MAX = 6
const setPet = (target, v) => { target.petStatus = target.petStatus === v ? '' : v }
// 没选就筛不到的只有这两项（性别、在店选「不限」的按什么条件筛都看得到）；哪项没选写哪项，都选了就没有这句
const filterNote = computed(() => {
  const f = form.value
  const missing = [!f.restMode && '休息排班', housingOf(f) && !f.roomType && '住宿条件'].filter(Boolean)
  return missing.length ? missing.join('、') + '还没选：用户按' + (missing.length > 1 ? '这两项' : '这一项') + '筛选时看不到这个岗位。' : ''
})
// 线上任务没有休息排班（选过再切到线上任务，也按没选算）
const restOn = (f) => f.jobType !== 'online' && !!f.restMode
// 生成描述 / 提交时按约定的名字带上；不适用的项一律传空（兼职、全职没有性别偏好，不包住没有房型，线上任务没有排班、在店天数、住宿）
const conditionPayload = (f) => ({
  genderPref: f.jobType === 'volunteer' ? (f.genderPref || '') : '',
  restMode: restOn(f) ? f.restMode : '',
  roomType: housingOf(f) ? (f.roomType || '') : '',
  minDays: f.jobType !== 'online' && Number(f.minDays) > 0 ? Number(f.minDays) : null
})
// E1 新增的几项（服务端 KgStaffJobService.Draft.readPublishFields）：线上任务一项都不带；结算方式不给换宿；试用期、培训、门店类型只给全职
const publishExtras = (f) => {
  const offline = f.jobType !== 'online'
  const full = f.jobType === 'fulltime'
  const board = offline ? boardOf(f) : ''
  return {
    boardType: board,
    boardDesc: offline && board !== 'none' ? String(f.boardDesc || '').trim() : '',
    dailyHours: offline ? String(f.dailyHours || '').trim() : '',
    shiftTime: offline ? String(f.shiftTime || '').trim() : '',
    settleDesc: offline && f.jobType !== 'volunteer' ? (f.settleDesc || '') : '',
    probation: full ? (f.probation || '') : '',
    trainDesc: full ? String(f.trainDesc || '').trim() : '',
    category: full ? (f.category || '') : '',
    ...(offline ? extrasPayload(f) : {})
  }
}
/** V66 的七个键（api.md 第 2 节）。发布、完善一律全带，不适用的传空：传了 '' / [] 服务端才清空，改成包吃、不包住之后老值才不会留着 */
function extrasPayload(f) {
  const meal = mealOn(f) ? String(f.mealAllowance || '').trim() : ''
  const pet = f.jobType === 'volunteer'
  const lodging = housingOf(f)
  const video = lodging ? (f.lodgingVideo || '') : ''
  return {
    mealAllowance: meal, mealAllowanceUnit: meal ? (f.mealAllowanceUnit || 'day') : '',
    petStatus: pet ? (f.petStatus || '') : '', petImages: pet && f.petStatus === 'yes' ? (f.petImages || []).slice() : [],
    lodgingImages: lodging ? (f.lodgingImages || []).slice() : [], lodgingVideo: video, lodgingVideoCover: video ? (f.lodgingVideoCover || '') : ''
  }
}
/** 交给服务端的「要求」：年龄、性格、技能各一行放在前面，后面是门店写的其他要求（用户端一行一条列出来；性别、年龄、性格短的横着排一行） */
function requirementText(f, hope) {
  const lines = []
  if (f.age) lines.push('年龄：' + f.age)
  if ((f.personality || []).length) lines.push('性格：' + f.personality.join('、'))
  if ((f.keywords || []).length) lines.push('技能：' + f.keywords.join('、'))
  for (const line of String(hope || '').split(/\r?\n/)) if (line.trim()) lines.push(line.trim())
  return lines.join('\n')
}

// 技能 / 关键词（最多 4 个）：清单来自服务端（描述模板认得的词，也是用户端「技能需求」筛选的词），可以自定义
const keywordOptions = ref([])
const loadKeywordOptions = async () => {
  if (keywordOptions.value.length) return
  try { keywordOptions.value = (await apiStaffJobKeywords()).data || [] } catch (e) { keywordOptions.value = [] }
}
// 年龄段、性格的选项（V67 /app/job/requirement-options，后台可配）：取一次，取不到用 REQ_FALLBACK
const reqOptions = ref(REQ_FALLBACK)
let reqOptionsLoaded = false
const textList = (v) => (Array.isArray(v) ? v.map(x => String(x || '').trim()).filter(Boolean) : null)
const loadReqOptions = async () => {
  if (reqOptionsLoaded) return
  try {
    const d = (await get('/app/job/requirement-options')).data || {}
    const ages = textList(d.ages), personalities = textList(d.personalities)
    if (!ages || !personalities) return
    reqOptions.value = { ages, personalities, personalityMax: Number(d.personalityMax) > 0 ? Number(d.personalityMax) : REQ_FALLBACK.personalityMax }
    reqOptionsLoaded = true
  } catch (e) { /* 老服务端没有这个接口：用默认那组 */ }
}
// 年龄弹层：「不限」选了就是空（不写这一行）；后台没配「不限」也给一行「不限」，选过的能清掉。
// 岗位上原来的年龄不在选项里（老岗位手写的「18周岁以上」、后来停用的）也列出来，打开就是选中的
function ageSheet(age) {
  const options = reqOptions.value.ages.map(a => ({ label: a, value: a === '不限' ? '' : a }))
  if (age && !options.some(o => o.value === age)) options.push({ label: age, value: age })
  return { title: '年龄', value: age || '', emptyLabel: options.some(o => o.value === '') ? '' : '不限', options }
}
// 自定义过的关键词不在后台清单里，也要列出来（已选中）；选、自己写都在底部弹层里（最多 4 个）
const skillChips = computed(() => keywordOptions.value.concat(form.value.keywords.filter(k => !keywordOptions.value.includes(k))))
// 换工类型：之前发布换工岗位只能写关键词，用户只能按标题去猜；现在选一个类型（日常 / 剪辑 / 直播 / 摄影 / 手作…），
// 用户在「换宿旅行」里点类型就能筛到。清单来自后台字典，运营可以改；服务端只认启用中的类型。类型的说明在底部弹层里
const kindOptions = ref([])
const loadKindOptions = async () => {
  if (kindOptions.value.length) return
  try { kindOptions.value = (await apiJobKinds()).data || [] } catch (e) { kindOptions.value = [] }
}
const goInsurance = () => go(staffStoreUrl('/pages/staff/insurance'))
const showCertification = () => alert('安心商家认证', '请由有门店认证权限的后台人员，在「袋鼠全球青年 → 门店管理」找到本门店，核实后点击「认证」。认证状态由门店统一提供，发布岗位不会自动认证；房源资质审核需另外办理。')
const toggleInsurance = () => {
  if (!canEdit.value || form.value.jobType === 'online') return
  form.value.insuranceFlag = form.value.insuranceFlag === '0' ? '1' : '0'
}
// 「做满一个月有红包」只是一个标记（列表卡片、筛选用），勾上不再顺手打开「奖金」：之前会自动开奖金、填一句奖金规则，
// 岗位上平白多出一个「奖金」标签。取消勾选时，奖金规则还是当初自动填的那句就一起清掉（门店自己改过的不动）
const REDPACKET_RULE = '做满一个月有红包'
const toggleRedpacket = () => {
  if (!canEdit.value || form.value.jobType === 'online') return
  const on = !form.value.monthRedpacket
  form.value.monthRedpacket = on
  if (!on && String(form.value.bonusDesc || '').trim() === REDPACKET_RULE) {
    form.value.bonusDesc = ''
    form.value.bonusEnabled = false
  }
}

// ---------------- 填写检查（就地提示） ----------------
// 点「提交审核」之后才开始标红（还没提交过不吓人）；之后边改边消。每一项的说法都写清楚缺什么、怎么补
const tried = ref(false)
// 第一个错要按页面从上到下的顺序：其他要求在折叠区，排到工作内容、薪资、餐补后面；换工的补贴也在折叠区，排在其他要求后面。
// 2026-11-03 改版后「必填信息」一组是 标题、照片、地点、工作内容、薪资，到岗日期在下一组「时间和待遇」
const ERR_ORDER = ['title', 'images', 'address', 'work', 'salary', 'startDate', 'meal', 'hope', 'bonus', 'commission']
const errOrder = (f) => (f.jobType === 'volunteer' ? ['title', 'images', 'address', 'work', 'startDate', 'genderCounts', 'meal', 'hope', 'salary', 'bonus', 'commission'] : ERR_ORDER)
// 折叠区里的项；补贴只有换工在折叠区，兼职、全职的薪资在外面
const foldKeys = (f) => (f.jobType === 'volunteer' ? ['hope', 'salary', 'bonus', 'commission'] : ['hope', 'bonus', 'commission'])
const FOLD_NAMES = { hope: '其他要求', salary: '补贴', bonus: '奖金', commission: '提成' }
function formErrors(f, g) {
  const e = {}
  if (!String(g.title || '').trim()) e.title = '请填写岗位标题'
  if (f.jobType !== 'online' && !(f.images || []).some(url => typeof url === 'string' && url.trim())) e.images = '请至少上传 1 张岗位照片'
  // 新开通的商家店没有登记地址，「默认门店地址」等于空：要自己填（服务端同样拒绝）
  if (f.jobType !== 'online' && !storeAddress.value && !String(f.address || '').trim()) e.address = '这家店还没有登记地址，请填写工作地点'
  if (!isYmd(f.startDate)) e.startDate = '请选择到岗日期'
  if (genderPlanError(f)) e.genderCounts = genderPlanError(f)
  if (requirementText(f, g.hope).length > 300) e.hope = '要求太长了：连同年龄、性格、技能一共 300 字以内'
  if (!String(g.work || '').trim()) e.work = '请写几句工作内容：用户最想知道每天做什么'
  if (jobBenefits(f).salaryEnabled && parseSalaryAmount(f.salary) === null) {
    e.salary = f.jobType === 'volunteer' ? '请填写补贴金额（大于 0，最多两位小数），或关掉「另有补贴」' : '请填写薪资金额（大于 0，最多两位小数）'
  }
  if (mealOn(f) && mealError(f.mealAllowance)) e.meal = mealError(f.mealAllowance)
  if (f.bonusEnabled && !String(f.bonusDesc || '').trim()) e.bonus = '请写清奖金怎么算，或关掉「奖金」'
  if (f.commissionEnabled && !String(f.commissionDesc || '').trim()) e.commission = '请写清提成怎么算，或关掉「提成」'
  return e
}
const err = computed(() => (tried.value && formOpen.value ? formErrors(form.value, gen.value) : {}))
const errCount = computed(() => Object.keys(err.value).length)
// 收起时头上写还差什么：折叠区里的错不能藏住
const foldErrText = computed(() => {
  const names = foldKeys(form.value).filter(k => err.value[k]).map(k => FOLD_NAMES[k])
  return names.length ? '有 ' + names.length + ' 项要补：' + names.join('、') : ''
})
// 底部提交栏上面一行（2026-11-03 主人：操作太繁琐看不懂）：不等点提交，一直写着还差哪几项；点了标红、滚到第一项（折叠区的先展开）
const TODO_NAMES = { genderCounts: '男生、女生人数', title: '岗位标题', images: '岗位照片', address: '工作地点', startDate: '到岗日期', work: '工作内容', salary: '薪资金额', meal: '餐补金额', hope: '其他要求（太长了）', bonus: '奖金说明', commission: '提成说明' }
const todoKeys = computed(() => {
  if (!formOpen.value) return []
  const f = form.value
  const e = formErrors(f, gen.value)
  return errOrder(f).filter(k => e[k])
})
const todoText = computed(() => {
  const keys = todoKeys.value
  if (!keys.length) return '必填的都填好了，可以提交'
  const names = keys.map(k => (k === 'salary' && form.value.jobType === 'volunteer' ? '补贴金额' : TODO_NAMES[k]))
  return '还差：' + names.join('、') + '（点这里去填）'
})
function showTodo() {
  if (!todoKeys.value.length) return
  tried.value = true
  revealFirstErr()
}
// 停在吸顶顶栏下面：顶栏 = 状态栏 + 44，再留 12（iPhone X 上状态栏 44，原来写死的 -72 字段名会被盖住）
const fieldGap = () => { try { return (uni.getSystemInfoSync().statusBarHeight || 20) + 44 + 12 } catch (e) { return 72 } }
function scrollToField(key) {
  if (typeof uni === 'undefined' || !uni.pageScrollTo) return
  // #ifdef H5
  // 网页版的 pageScrollTo 不认 offsetTop，按 selector 滚会把字段停到吸顶顶栏（44 + 44）后面，报错的输入框看不见：自己量
  const el = typeof document !== 'undefined' && document.querySelector && document.querySelector('#pf-' + key)
  if (el) { uni.pageScrollTo({ scrollTop: Math.max(0, el.getBoundingClientRect().top + window.pageYOffset - 100), duration: 200 }); return }
  // #endif
  try { uni.pageScrollTo({ selector: '#pf-' + key, duration: 200, offsetTop: -fieldGap() }) } catch (e) { /* 定位不到就算了，红字和提示照样有 */ }
}
/** 提示第一项并滚过去；折叠区有错就先展开。提交时和点操作条上「还有 N 项要补」都走这里 */
function revealFirstErr() {
  const f = form.value
  const errs = formErrors(f, gen.value)
  const first = errOrder(f).find(k => errs[k])
  if (!first) return false
  toast(errs[first])
  const closed = !moreOpen.value && foldKeys(f).some(k => errs[k])
  if (closed) moreOpen.value = true
  // 折叠区用 v-if，刚展开时节点还没出来，等一下再滚。
  // 不要 await nextTick()：测试的沙箱把没给的导入都换成永远不返回的函数，submitJob 会卡死
  if (closed) setTimeout(() => scrollToField(first), 80)
  else scrollToField(first)
  return true
}

// ---------------- 工作地点（V42） ----------------
// 门店替合作商户（如南舍庄园、李喵喵民宿）招人时，工作地点不在门店：可以在地图上搜索店名选点（微信小程序），也可以手填。
// 选点只在点了「地图搜索选点」之后才打开地图，不在进页面时要定位。网页版没有地图，只能手填。
// 坐标是 GCJ-02（微信地图选点给的就是），服务端同样校验：成对、在范围内、不是 0,0
const apiStaffJobLocation = (jobId, payload) => post('/app/staff/jobs/' + jobId + '/location', payload)
const pointOf = (v = {}) => {
  if (v.latitude == null || v.longitude == null || String(v.latitude).trim() === '' || String(v.longitude).trim() === '') return null
  const latitude = Number(v.latitude), longitude = Number(v.longitude)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || (latitude === 0 && longitude === 0)) return null
  return { latitude, longitude }
}
const PLACE_MAP = '地图搜索选点', PLACE_TYPE = '手动填写地址', PLACE_STORE = '改回门店地址'
const placeOptions = (custom) => {
  const opts = []
  // #ifdef MP-WEIXIN
  opts.push(PLACE_MAP)
  // #endif
  opts.push(PLACE_TYPE)
  if (custom) opts.push(PLACE_STORE)
  return opts
}
const placeText = computed(() => form.value.address || (storeAddress.value ? '默认：门店地址 ' + storeAddress.value : '请选择或填写工作地点'))
// 表单上只有手填没坐标时才显示 placeHint 那句（取值已经写了「默认：门店地址」，别的情况不用再说一遍）
const placeTyped = computed(() => !!form.value.address && !pointOf(form.value))
const placeHint = computed(() => {
  const f = form.value
  if (pointOf(f)) return '已在地图上选点，求职者在岗位详情里点「工作地点」可以打开地图导航。'
  if (f.address) return '手填的地址没有地图位置，岗位详情里只显示文字；在小程序里用「地图搜索选点」可以带上位置。'
  return storeHasPoint.value ? '不选就用门店地址和门店登记的地图位置。' : '不选就用门店地址；替别的商户招人时，请改成实际工作的地方。'
})
/** 微信地图选点：名字 + 地址拼成工作地点（和房源选点同一写法）；取消、没授权、打不开都返回 null */
async function chooseOnMap(current = {}) {
  // #ifdef MP-WEIXIN
  try {
    const result = await new Promise((resolve, reject) => uni.chooseLocation({ ...(pointOf(current) || {}), success: resolve, fail: reject }))
    const point = pointOf(result)
    if (!point) { await alert('没有选到有效位置', '请重新在地图上搜索、确认工作地点。'); return null }
    let address = String(result.address || '').trim()
    const name = String(result.name || '').trim()
    if (name && !address.includes(name)) address += name
    address = (address || String(current.address || '').trim()).slice(0, 255)
    if (!address) { await alert('没有拿到地址', '请重新选点，或改用「手动填写地址」。'); return null }
    return { ...point, address }
  } catch (error) {
    const message = String(error?.errMsg || '')
    if (/cancel/i.test(message)) return null
    if (/auth deny|auth denied|authorize|permission/i.test(message)) {
      if (await confirm('需要位置授权', '请在设置里允许使用位置信息，再点「地图搜索选点」；也可以先手动填写地址。')) uni.openSetting({ fail: () => {} })
    } else {
      await alert('地图暂时无法打开', '请稍后重试，或先手动填写工作地点。')
    }
    return null
  }
  // #endif
  // #ifndef MP-WEIXIN
  return null
  // #endif
}
/** 手填地址：手填的没有地图位置，原来选的点会清掉（免得点开地图还是旧地方） */
async function typePlace(current = {}) {
  if (pointOf(current) && !(await confirm('手动填写地址', '手填的地址没有地图位置，原来在地图上选的点会清掉，岗位详情就不能点开地图了。继续？'))) return null
  const v = await prompt('工作地点', { value: current.address || '', placeholder: '例如：福州市闽侯县南舍庄园' })
  if (v === null) return null
  if (!v) { toast('请填写工作地点'); return null }
  return { address: v.slice(0, 255), latitude: null, longitude: null }
}
async function pickPlace() {
  const f = form.value
  const opts = placeOptions(!!f.address)
  const i = await sheet(opts)
  if (i < 0) return
  let next = null
  if (opts[i] === PLACE_STORE) next = { address: '', latitude: null, longitude: null }
  else if (opts[i] === PLACE_MAP) next = await chooseOnMap({ latitude: f.latitude, longitude: f.longitude, address: f.address })
  else next = await typePlace(f)
  // 选点期间表单被重置（提交成功、重新发布）就不写回去
  if (!next || form.value !== f) return
  Object.assign(f, next)
}
// 已发岗位改工作地点：立即生效，不用重新审核（服务端按岗位所在门店核对「岗位管理·编辑」权限）
let moving = false
async function movePlace(j) {
  if (moving) return
  const opts = placeOptions(false)
  const i = await sheet(opts)
  if (i < 0) return
  const current = { latitude: j.latitude, longitude: j.longitude, address: j.address }
  const next = opts[i] === PLACE_MAP ? await chooseOnMap(current) : await typePlace(current)
  if (!next) return
  moving = true
  try {
    const res = await apiStaffJobLocation(j.jobId, next)
    toast(res.msg || '工作地点已更新')
    loadJobs()
  } catch (e) {
    toast(errText(e, '修改失败'))
  } finally {
    moving = false
  }
}

// ---------------- 补填筛选条件（10-16 跟进） ----------------
// 老岗位发布时还没有 性别偏好 / 休息排班 / 住宿条件 / 最短在店（V48 才有），用户按这些条件筛时看不到它们。
// 店长、管家在卡片菜单「补填筛选条件」或列表顶上的提示里补上：选项和适用范围与发布页同一组（GENDER_OPTS 等，提交前按 conditionPayload 收口），
// 调 PUT /app/staff/jobs/{id}/conditions（写在分包页面里，不进主包的 common/api.js）。服务端按岗位所在门店核对「岗位管理·编辑」，立即生效、不用重新审核
const COND_ACTION = '补填筛选条件'
const apiStaffJobConditions = (jobId, payload) => put('/app/staff/jobs/' + jobId + '/conditions', payload)
const missingCount = ref(0)
const missingJob = ref(null)
// condSheet = { jobId, title, jobType, housing, draft: { genderPref, restMode, roomType, minDays } }
const condSheet = ref(null)
const condSaving = ref(false)
// 线下、没关闭的岗位才能补（草稿也行：审核通过后就带着条件上架）；列表行的原始状态在 rawStatus，顶上提示带来的那一个在 status
const condEditable = (j) => !!j && j.jobType !== 'online' && ['draft', 'published', 'paused'].includes(j.rawStatus || j.status)
// 包不包住：服务端给了 housing 就用它（换工换宿，或食宿是包吃包住 / 包住宿）；老接口没给时按同一规则自己算
const condHousing = (j) => (typeof j.housing === 'boolean' ? j.housing : j.jobType === 'volunteer' || ['all', 'room'].includes(j.boardType))
// 只有休息排班、住宿条件没填会让岗位在筛选里被漏掉；性别、最短在店选「不限」的，用户按什么条件筛都看得到（10-16 复查：之前说「没填的项都看不到」，不对）
const condHint = computed(() => {
  const c = condSheet.value
  const days = c && Number(c.draft.minDays) > 0 && !MIN_DAY_OPTS.some(o => o[1] === Number(c.draft.minDays)) ? `现在写的是最短在店 ${c.draft.minDays} 天。` : ''
  const hidden = c && c.housing ? '休息排班、住宿条件没填的' : '休息排班没填的'
  const open = c && c.jobType === 'volunteer' ? '性别和在店选「不限」的' : '在店选「不限」的'
  return days + hidden + '，用户按这一项筛选时看不到这个岗位；' + open + '按什么条件筛都看得到。保存后马上生效，不用重新审核。'
})
function openConditions(j) {
  if (!canEdit.value || !staffCan('jobs', 'edit')) return toast('当前角色没有岗位编辑权限')
  if (!condEditable(j)) return toast(j && j.jobType === 'online' ? '线上任务没有这些条件' : '岗位关闭后无法再改筛选条件')
  condSheet.value = {
    jobId: j.jobId, title: j.title || '', jobType: j.jobType, housing: condHousing(j),
    genderPlan: genderCountText(j),
    draft: { genderPref: j.genderPref || '', restMode: j.restMode || '', roomType: j.roomType || '', minDays: Number(j.minDays) > 0 ? Number(j.minDays) : null }
  }
}
// 顶上提示的「去补填」：最新的那个没填的岗位；它在当前列表里就用列表里的这一行，不在（被类型 / 状态筛掉了）就用服务端一起给的那一个
function fillFirstMissing() {
  const m = missingJob.value
  if (!m) return
  openConditions(jobList.value.find(r => r.jobId === m.jobId) || m)
}
const closeConditions = () => { condSheet.value = null }
// 单选，再点一下已选的就是不填
const toggleCond = (key, v) => {
  const c = condSheet.value
  if (c) c.draft[key] = c.draft[key] === v ? '' : v
}
async function saveConditions() {
  const c = condSheet.value
  if (!c || condSaving.value) return
  condSaving.value = true
  try {
    // 和发布同一个收口：不是换宿不带性别，不包住不带房型
    const payload = conditionPayload({ jobType: c.jobType, boardEnabled: c.housing, ...c.draft })
    const res = await apiStaffJobConditions(c.jobId, payload)
    const saved = res.data || {}
    // 先把这一行改过来，再重新拉一次列表：顶上「N 个岗位还没填」跟着变
    rows.value = rows.value.map(r => (r.jobId === c.jobId ? { ...r, ...saved } : r))
    if (condSheet.value === c) condSheet.value = null
    toast('已保存')
    loadJobs()
  } catch (e) {
    toast(errText(e, '保存失败'))
  } finally {
    condSaving.value = false
  }
}
// ---------------- 岗位照片（V49） ----------------
// 发布页可以带照片，已发的线下岗位在卡片菜单「换岗位照片」整组换。照片先用现成的 /app/upload/image 传上去（和活动封面、社区发帖同一个上传接口），
// 交给服务端的是平台图片路径；服务端只收本平台上传的 /profile/upload/…，最多 9 张，第一张做封面（列表卡片、详情头图都用它）。
// 换照片调 PUT /app/staff/jobs/{id}/images（写在分包页面里，不进主包的 common/api.js），服务端按岗位所在门店核对「岗位管理·编辑」
const PHOTO_MAX = 9
const PHOTO_HINT = '至少上传 1 张，最多 9 张，第一张做封面；点照片可以设为封面、往前挪或替换。未上传照片不能提交。'
const PHOTO_ACTION = '换岗位照片'
const EXTRAS_ACTION = '住宿与宠物'
const EDIT_ACTIONS = ['修改工作地点', COND_ACTION, PHOTO_ACTION, EXTRAS_ACTION]
const EDIT_MORE = '改地点 / 筛选条件 / 照片 / 住宿…'
const apiStaffJobImages = (jobId, images) => put('/app/staff/jobs/' + jobId + '/images', { images })
// 上传中再点「+」会叠着再选一批；保存时还在传也先等等
let photoUploading = false
/** 选图（最多补到 max 张）→ 逐张上传 → 路径追加到 list（发布表单的岗位照片、住宿照片、宠物照片，或弹层的 draft）；传失败的几张提示一句，传上的照样留着 */
async function addPhotos(list, max = PHOTO_MAX) {
  if (photoUploading) return
  const left = max - list.length
  if (left <= 0) return toast('最多 ' + max + ' 张照片')
  const paths = await chooseImages(left)
  if (!paths || !paths.length) return
  photoUploading = true
  uni.showLoading({ title: '上传中', mask: true })
  let failed = 0
  let lastError = null
  try {
    for (const p of paths) {
      if (list.length >= max) break
      try {
        const res = await uploadTo('/app/upload/image', p)
        const url = res && res.data && res.data.url
        if (url && !list.includes(url)) list.push(url)
      } catch (e) {
        failed++
        lastError = e
      }
    }
  } finally {
    uni.hideLoading()
    photoUploading = false
  }
  if (failed) toast(failed === paths.length ? errText(lastError, '照片上传失败，请重试') : `有 ${failed} 张没传上，可以再加一次`)
}
const removePhoto = (list, i) => { list.splice(i, 1) }
// cover = false：住宿、宠物照片没有封面这回事，不出「设为封面」
async function photoActions(list, i, cover = true) {
  const opts = [...(i > 0 ? [...(cover ? ['设为封面'] : []), '往前挪一位'] : []), '看大图', '删掉这张']
  const k = await sheet(opts)
  if (k < 0 || i >= list.length) return
  const a = opts[k]
  if (a === '设为封面') list.unshift(list.splice(i, 1)[0])
  else if (a === '往前挪一位') list.splice(i - 1, 0, list.splice(i, 1)[0])
  else if (a === '删掉这张') list.splice(i, 1)
  else uni.previewImage({ urls: list.map(u => absUrl(u)), current: absUrl(list[i]) })
}
// photoSheet = { jobId, title, draft: [路径], before: [打开时的路径] }
const photoSheet = ref(null)
const photoSaving = ref(false)
function openPhotos(j) {
  if (!canEdit.value || !staffCan('jobs', 'edit')) return toast('当前角色没有岗位编辑权限')
  if (!condEditable(j)) return toast(j && j.jobType === 'online' ? '线上任务没有岗位照片' : '岗位关闭后无法再换照片')
  const images = (Array.isArray(j.images) ? j.images : []).filter(Boolean)
  photoSheet.value = { jobId: j.jobId, title: j.title || '', draft: images.slice(), before: images.slice() }
}
const closePhotos = () => { photoSheet.value = null }
async function savePhotos() {
  const p = photoSheet.value
  if (!p || photoSaving.value) return
  if (photoUploading) return toast('照片还在上传，请稍等')
  if (!p.draft.length) return toast('请至少保留 1 张岗位照片')
  // 没改：直接收起，不发请求
  if (p.draft.join(',') === p.before.join(',')) { photoSheet.value = null; return }
  // 确认框弹着时再点「保存」也不会再发一次
  photoSaving.value = true
  try {
    const res = await apiStaffJobImages(p.jobId, p.draft.slice())
    const saved = res.data || {}
    // 先把这一行的照片和封面改过来，再重新拉一次列表
    rows.value = rows.value.map(r => (r.jobId === p.jobId ? { ...r, images: saved.images || p.draft.slice(), img: saved.cover || r.img } : r))
    if (photoSheet.value === p) photoSheet.value = null
    toast(res.msg || '照片已更新')
    loadJobs()
  } catch (e) {
    toast(errText(e, '保存失败'))
  } finally {
    photoSaving.value = false
  }
}

// ---------------- 住宿照片、视频（R4，V66） ----------------
// 视频规则和小院视频一样（kind=intro：3 分钟、200MB），分段上传沿用 stay-video.js（同在 staff 分包，不进 common）。target 是发布表单或「住宿与宠物」弹层的草稿。
// 上传时盖一层转圈（和 rooms.vue 传小院视频同一个做法）；切到后台 5 秒上传会断，所以说明换成提醒别离开
const VIDEO_NOTE = '视频从相册选，不超过 3 分钟、200MB'
const VIDEO_BUSY_NOTE = '视频上传中，请别切到别的应用'
const videoUploading = ref(false)
async function addLodgingVideo(target) {
  if (videoUploading.value) return
  try {
    // 选好、检查过才算上传中：网页版在选文件框里点取消，没有任何回调，早早置上就再也点不动、也提交不了
    const saved = await chooseAndUploadVideo((pct) => uni.showLoading({ title: '视频上传中 ' + pct + '%', mask: true }), {
      upload: (f, cb) => { videoUploading.value = true; uni.showLoading({ title: '视频上传中', mask: true }); return uploadVideoParts(f, cb) }
    }, { intro: true, label: '住宿视频' })
    if (saved && saved.url) { target.lodgingVideo = saved.url; target.lodgingVideoCover = saved.cover || '' }
  } catch (e) {
    toast(errText(e, '视频上传失败，请重试'))
  } finally {
    uni.hideLoading()
    videoUploading.value = false
  }
}
const removeLodgingVideo = (target) => { target.lodgingVideo = ''; target.lodgingVideoCover = '' }
async function lodgingVideoActions(target) {
  const opts = ['看视频', '换一段', '删掉视频']
  const k = await sheet(opts)
  if (k === 0) playVideoFull(absUrl(target.lodgingVideo), target.lodgingVideoCover ? absUrl(target.lodgingVideoCover) : '')
  else if (k === 1) await addLodgingVideo(target)
  else if (k === 2) removeLodgingVideo(target)
}

// ---------------- 住宿与宠物（已发岗位补资料，R2、R3、R4，V66） ----------------
// GET / PUT /app/staff/jobs/{id}/extras（写在分包页面里，不进主包的 common/api.js）：服务端按岗位所在门店核对「岗位管理」权限；线上 422、已关闭 409、合作商家上架后 403；
// PUT 只改带了的键，立即生效、不用重新审核。没有它老岗位在手机上加不了，只能去电脑后台
const extrasApi = (jobId) => '/app/staff/jobs/' + jobId + '/extras'
// extrasSheet = { jobId, title, mealShown, housing, petShown, draft: { 七个键 }, before: 打开时的内容 }
const extrasSheet = ref(null)
const extrasSaving = ref(false)
const extrasErr = computed(() => (extrasSheet.value && extrasSheet.value.mealShown ? mealError(extrasSheet.value.draft.mealAllowance) : ''))
const closeExtras = () => { extrasSheet.value = null }
/** 只带这个岗位看得到的那几块：服务端只改带了的键 */
function extrasBody(c) {
  const d = c.draft, out = {}
  if (c.mealShown) {
    const meal = String(d.mealAllowance || '').trim()
    out.mealAllowance = meal
    out.mealAllowanceUnit = meal ? (d.mealAllowanceUnit || 'day') : ''
  }
  if (c.housing) {
    out.lodgingImages = d.lodgingImages.slice()
    out.lodgingVideo = d.lodgingVideo || ''
    out.lodgingVideoCover = d.lodgingVideo ? (d.lodgingVideoCover || '') : ''
  }
  if (c.petShown) {
    out.petStatus = d.petStatus || ''
    out.petImages = d.petStatus === 'yes' ? d.petImages.slice() : []
  }
  return out
}
let extrasOpening = false
async function openExtras(j) {
  if (!canEdit.value || !staffCan('jobs', 'edit')) return toast('当前角色没有岗位编辑权限')
  if (!condEditable(j)) return toast(j && j.jobType === 'online' ? '线上任务没有住宿和宠物资料' : '岗位关闭后无法再改')
  if (extrasOpening) return
  extrasOpening = true
  try {
    const d = (await get(extrasApi(j.jobId))).data || {}
    if (!d.mealShown && !d.housing && !d.petShown) return toast('这个岗位不包住也不用填餐补，没有要补的资料')
    const list = (v) => (Array.isArray(v) ? v.filter(Boolean) : [])
    const c = {
      jobId: j.jobId, title: j.title || '', mealShown: !!d.mealShown, housing: !!d.housing, petShown: !!d.petShown,
      draft: {
        mealAllowance: d.mealAllowance || '', mealAllowanceUnit: d.mealAllowanceUnit || 'day', petStatus: d.petStatus || '', petImages: list(d.petImages),
        lodgingImages: list(d.lodgingImages), lodgingVideo: d.lodgingVideo || '', lodgingVideoCover: d.lodgingVideoCover || ''
      }
    }
    c.before = JSON.stringify(extrasBody(c))
    extrasSheet.value = c
  } catch (e) {
    toast(errText(e, '读取失败'))
  } finally {
    extrasOpening = false
  }
}
async function saveExtras() {
  const c = extrasSheet.value
  if (!c || extrasSaving.value) return
  if (photoUploading) return toast('照片还在上传，请稍等')
  if (videoUploading.value) return toast('视频还在上传，请稍等')
  if (extrasErr.value) return toast(extrasErr.value)
  const body = extrasBody(c)
  // 没改：直接收起，不发请求
  if (JSON.stringify(body) === c.before) { extrasSheet.value = null; return }
  extrasSaving.value = true
  try {
    const res = await put(extrasApi(c.jobId), body)
    if (extrasSheet.value === c) extrasSheet.value = null
    toast(res.msg || '已保存')
  } catch (e) {
    toast(errText(e, '保存失败'))
  } finally {
    extrasSaving.value = false
  }
}

// H5 锁页面滚动（和岗位列表页 lockPageScroll 同一写法）：小程序靠顶上的 page-meta；H5 的 page-meta 关掉后清不掉样式，只能锁 body
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
// 列表屏的三个弹层（补填筛选条件、换岗位照片、住宿与宠物）、发布屏的底部弹层开着时锁住
const listSheetOpen = () => ((!!condSheet.value || !!photoSheet.value || !!extrasSheet.value) && s.value === 1) || (!!sheetKey.value && s.value === 2)
watch(listSheetOpen, (open) => lockPageScroll(open))
// 系统返回切走、离开本页：收起弹层、解锁
watch(s, (v) => { if (v !== 1) { condSheet.value = null; photoSheet.value = null; extrasSheet.value = null } if (v !== 2) { editing.value = ''; sheetKey.value = '' } })
onHide(() => lockPageScroll(false))
onUnload(() => lockPageScroll(false))

// ---------------- 预设模板，一键填写（2026-11-03） ----------------
// 主人：「优化界面，现在操作太繁琐了看不懂，增加一个预设模板，一键填写，我只要改一部分就行」。
// 模板在 ./job-templates.js（静态数据，不走服务端）：点一下改标题、工作内容、排班、食宿、要求这些，岗位照片、工作地点、到岗日期、人数等门店自己的不动；
// 再点别的模板整组换掉。「用上次的岗位」：这家店这一类最近一个上架（或暂停）的岗位，读用户端岗位详情（/app/job/{id}，草稿读不到），照片和日期不带。
// 填完收成一行「已按…填好」，能撤销（只还原这次改了的项）、能换一个。完善商家岗位时整块不出
const LAST_KEY = 'last'
const tplList = computed(() => {
  const list = templatesOf(form.value.jobType)
  return Array.isArray(list) ? list : []
})
// tplOpen：模板格子展开着；tplApplied：刚填过的 { key, label, patch }（patch 是撤销用的原值）；lastJob：上次的岗位 { jobId, title }，没有就不出那张卡
const tplOpen = ref(true)
const tplApplied = ref(null)
const lastJob = ref(null)
const tplShown = computed(() => !draftJob.value && (tplList.value.length > 0 || !!lastJob.value))
const stepTitles = computed(() => (tplShown.value ? ['第 2 步 · 必填信息', '第 3 步 · 时间和待遇'] : ['必填信息', '时间和待遇']))
function resetTemplate() {
  tplOpen.value = true
  tplApplied.value = null
  lastJob.value = null
  lastJobSeq++
}
// 取这一类最近一个上架 / 暂停的岗位（列表按状态排，所以取编号最大的）；换了类型或又开了一张表，晚回来的结果不要
let lastJobSeq = 0
async function loadLastJob(kind) {
  const seq = ++lastJobSeq
  try {
    const list = ((await apiStaffJobs({ storeId: currentStaffStoreId(), type: kind })).data || {}).rows || []
    if (seq !== lastJobSeq || form.value.jobType !== kind) return
    const top = list.filter(r => r.jobType === kind && ['published', 'paused'].includes(r.status))
      .reduce((a, r) => (!a || Number(r.jobId) > Number(a.jobId) ? r : a), null)
    lastJob.value = top ? { jobId: top.jobId, title: top.title || '' } : null
  } catch (e) { /* 取不到就不出「用上次的岗位」 */ }
}
const kindValues = () => kindOptions.value.map(k => k.value)
function fillWith(next, key, label) {
  const patch = undoPatch({ form: form.value, gen: gen.value }, next)
  form.value = next.form
  gen.value = next.gen
  editing.value = ''
  tplApplied.value = { key, label, patch }
  tplOpen.value = false
  toast('已填好，改一改就能提交')
}
function useTemplate(tpl) {
  if (!tpl || !canEdit.value) return
  const r = reqOptions.value
  fillWith(applyTemplate(form.value, gen.value, tpl, { ages: r.ages, personalities: r.personalities, personalityMax: r.personalityMax, kinds: kindValues() }), tpl.key, '已按「' + tpl.name + '」填好')
}
let lastLoading = false
async function useLastJob() {
  const j = lastJob.value
  if (!j || lastLoading || !canEdit.value) return
  const f = form.value
  lastLoading = true
  try {
    const job = (await get('/app/job/' + j.jobId)).data || {}
    if (form.value !== f) return
    if (job.jobType !== f.jobType) return toast('上次的岗位读取失败')
    // 用户端详情和完善商家岗位读的库行有两处写法不同：满月红包是 true / false，标签是数组
    const row = { ...job, monthRedpacket: job.monthRedpacket === true || job.monthRedpacket === '0' ? '0' : '1', tags: Array.isArray(job.tags) ? job.tags.join(',') : (job.tags || '') }
    const copied = draftJobForm(row, newForm(f.jobType), { categories: CATEGORY_OPTS, storeAddress: storeAddress.value })
    fillWith(mergeLastJob(f, copied, { kinds: kindValues() }), LAST_KEY, '已照上次的岗位「' + (job.title || j.title) + '」填好')
    // 上次存的是老工时（弹性时间等）：和完善商家岗位一样，点错了能点回去
    hoursBefore.value = legacyHoursOf(form.value.dailyHours)
  } catch (e) {
    toast(errText(e, '上次的岗位读取失败'))
  } finally {
    lastLoading = false
  }
}
function undoTemplate() {
  const a = tplApplied.value
  if (!a) return
  Object.assign(form.value, a.patch.form)
  gen.value = { ...gen.value, ...a.patch.gen }
  editing.value = ''
  tplApplied.value = null
  tplOpen.value = true
  toast('已撤销，恢复成填之前的样子')
}

// ---------------- 帮我起草 + 提交 ----------------
// 之前是第 3 屏「模板生成描述」：先生成、再逐项点开改、再提交。现在标题、工作内容、其他要求直接在表里写，
// 「帮我起草」（之前叫「按模板帮我写」，2026-11-03 顶上有了预设模板，改个名免得混）用同一个描述接口（规则模板，不调外部 AI）按已选的条件起草，只填还空着的项；三项都写了才问要不要整份替换
const generating = ref(false)
let genVariant = 0
async function generate() {
  const f = form.value
  // 线上任务不用这张表：交付物、截止时间、佣金和验收标准在线上任务发布页
  if (f.jobType === 'online') {
    if (await confirm('发布线上任务', '线上任务需要填写交付物、截止时间、佣金和验收标准，去线上任务发布页填写？')) go(R.staffOnline + '?s=1')
    return
  }
  if (generating.value) return
  // 2026-11-03 主人：简化。起草不再要求先选到岗日期：没选就不写「X 前后可以到岗」那句（服务端 describe 对空日期写「未填」，不拒）；提交时照样必填
  const filled = GEN_KEYS.filter(k => String(gen.value[k] || '').trim())
  const all = filled.length === GEN_KEYS.length
  if (all && !(await confirm('按模板重写', '标题、工作内容、其他要求都已经写了，用模板起的草稿整份替换掉？'))) return
  // 薪资、奖金、提成还没填好时先不带（服务端会因为金额 / 规则没写拒绝），模板照样能起草，只是不写待遇
  const draft = { ...f }
  if (!isYmd(f.startDate)) draft.startDate = ''
  if (jobBenefits(f).salaryEnabled && parseSalaryAmount(f.salary) === null) { draft.salaryEnabled = false; draft.pay = f.boardEnabled ? 'board' : 'none' }
  if (!String(f.bonusDesc || '').trim()) draft.bonusEnabled = false
  if (!String(f.commissionDesc || '').trim()) draft.commissionEnabled = false
  generating.value = true
  try {
    const res = await apiStaffDescribeJob(currentStaffStoreId(), { ...draft, ...genderPlanPayload(draft), ...salaryPayload(draft), ...conditionPayload(draft), ...publishExtras(draft), variant: genVariant })
    const d = res.data || {}
    genVariant = (Number(d.variant) || 0) + 1
    const next = { ...gen.value }
    for (const k of GEN_KEYS) if (all || !String(next[k] || '').trim()) next[k] = String(d[k] || '').slice(0, k === 'title' ? 30 : 300)
    gen.value = next
  } catch (e) {
    toast(errText(e, '生成失败'))
  } finally {
    generating.value = false
  }
}
const jobPayload = (f, title) => ({
  ...f, ...salaryPayload(f), ...conditionPayload(f), ...publishExtras(f), ...genderPlanPayload(f),
  title, intro: '', work: String(gen.value.work || '').trim(), hope: requirementText(f, gen.value.hope)
})
// 连点都只提交一次。2026-11-03 主人：简化——底栏一直写着「还差什么 / 可以提交」，点「提交」不再弹「确认提交？」，直接交、落到成功页（原来 2 步 → 1 步）
let submitting = false
async function submitJob() {
  if (submitting) return
  if (photoUploading) return toast('照片还在上传，请稍等')
  if (videoUploading.value) return toast('视频还在上传，请稍等')
  const f = form.value
  if (f.jobType === 'online') {
    // 线上任务要填交付物、截止时间、佣金与验收标准，走线上任务发布页
    if (await confirm('发布线上任务', '线上任务需要填写交付物、截止时间、佣金和验收标准，去线上任务发布页填写？')) go(R.staffOnline + '?s=1')
    return
  }
  // 缺的项就地标红，提示第一项并滚过去（折叠区有错先展开）
  tried.value = true
  if (revealFirstErr()) return
  const planError = genderPlanError(f)
  if (planError) return toast(planError)
  const salaryError = validateSalaryForm(f)
  if (salaryError) return toast(salaryError)
  submitting = true
  try {
    if (draftJob.value) return await saveDraft(f)
    if (merchantStaff.value && !await merchantAgreement.value?.confirm()) return
    if (merchantStaff.value && form.value.jobType === 'volunteer' && !await volunteerNotice.value?.confirm()) return
    const title = String(gen.value.title || '').trim()
    const res = await apiStaffCreateJob(currentStaffStoreId(), jobPayload(f, title))
    toast(res.msg || '已提交平台审核')
    // 提交成功就清掉这份草稿（连点、返回再点都不会重复建岗位），页面换成「已提交，等平台审核」
    // 商家发的走派单（V63）：服务端说清去向（message），不是平台审核
    submitted.value = { title, jobId: res.data && res.data.jobId, message: res.data && res.data.message }
    form.value = newForm(f.jobType)
    gen.value = {}
    tried.value = false
    editing.value = ''
    moreOpen.value = false
    resetTemplate()
    loadJobs()
  } catch (e) {
    toast(errText(e, '提交失败'))
  } finally {
    submitting = false
  }
}

// ---------------- s=4 分享追踪 ----------------
const shareJob = ref(null)
const share = ref({})
// 转发给好友要用 friend 渠道的分享码，进本屏时先取好（只取码，不记分享次数）
const shareCodes = ref({})
const dim = ref('channel')
const stats = ref({})
const DIM_TITLE = { channel: '分享渠道数据', staff: '员工分享数据', manager: '换工主理人分享数据' }
const DIM_HEAD = { channel: '渠道', staff: '员工', manager: '换工主理人' }
const dimTitle = computed(() => DIM_TITLE[dim.value])
const dimHead = computed(() => DIM_HEAD[dim.value])
const channelRows = computed(() => stats.value.rows || [])
const statTotal = computed(() => stats.value.total || { visit: 0, apply: 0, pass: 0, rate: '—' })
const ranks = computed(() => stats.value.ranks || [])
const linkHint = computed(() => (shareJob.value ? '链接生成中…' : '岗位上架后生成分享链接'))
// 分享追踪的返回：从列表点「分享与追踪」进来的、刚提交完岗位落到这里的（草稿已清空），都回岗位列表；
// 直接打开本屏的回来源页。之前固定回第 3 屏：从列表进来看到空的描述页，提交后返回还能再提交一次
let shareFromPage = false
const backFromShare = () => { if (entryScreen === 4 && !shareFromPage) back(); else s.value = 1 }

async function openShare(j) {
  shareFromPage = true
  shareJob.value = j
  share.value = {}
  shareCodes.value = {}
  s.value = 4
  loadStats()
  try {
    const [link, friend] = await Promise.all([
      apiStaffShareJob(j.jobId, 'link', false),
      apiStaffShareJob(j.jobId, 'friend', false)
    ])
    share.value = link.data || {}
    shareCodes.value = { friend: (friend.data || {}).shareCode }
  } catch (e) {
    toast(errText(e, '分享链接生成失败'))
  }
}
async function loadStats() {
  // 合作商家的分享页只有链接 + 海报（2026-11-03 主人：简化），不取追踪表
  if (merchantStaff.value) return
  try {
    const res = await apiStaffShareStats({
      storeId: currentStaffStoreId(),
      jobId: shareJob.value ? shareJob.value.jobId : undefined,
      dim: dim.value
    })
    stats.value = res.data || {}
  } catch (e) {
    toast(errText(e, '分享数据加载失败'))
  }
}
const setDim = (v) => { dim.value = v; loadStats() }
async function copyLink() {
  if (!shareJob.value) return toast('岗位上架后才能分享')
  try {
    const res = await apiStaffShareJob(shareJob.value.jobId, 'link', true)
    share.value = res.data || share.value
    copy(share.value.link, '链接已复制')
    loadStats()
  } catch (e) {
    toast(errText(e, '复制失败'))
  }
}
async function savePoster() {
  if (!shareJob.value) return toast('岗位上架后才能生成海报')
  try {
    const res = await apiStaffShareJob(shareJob.value.jobId, 'poster', true)
    const p = res.data || {}
    await savePosterImage({ cover: p.cover || '/static/media/cover-empty.png', title: p.title, summary: p.summary, code: p.shareCode })
    toast('海报已保存')
    loadStats()
  } catch (e) {
    toast(errText(e, '海报保存失败'))
  }
}
const showAllRanks = () => {
  const all = stats.value.allRanks || []
  if (!all.length) return toast('还没有员工分享记录')
  alert('员工分享榜', all.map((r, i) => `${i + 1}. ${r.name}（ID: ${r.id}）分享 ${r.share} · 报名 ${r.apply} · 通过 ${r.pass}`).join('\n'))
}

// 右上角转发给好友 / 群：带本人的 friend 分享码，转发即记一次分享。
// 朋友圈转发打开的是当前页（员工页），对用户没有意义，所以不开朋友圈分享钩子（注意别在注释里写出那个钩子的名字：编译器按文本扫描，会当成已注册）
const shareTarget = (channel) => {
  const j = shareJob.value
  const code = shareCodes.value[channel]
  if (!j || !code) return null
  apiStaffShareJob(j.jobId, channel, true).catch(() => {})
  return { title: j.title, code, jobId: j.jobId }
}
onShareAppMessage(() => {
  const t = s.value === 4 ? shareTarget('friend') : null
  return t ? { title: t.title, path: `/pages/jobs/detail?jobId=${t.jobId}&sc=${t.code}` } : { title: '袋鼠全球青年', path: '/pages/home/index' }
})
</script>

<style scoped lang="scss">
/* 发布入口（四个板块）、提交成功的样式在 ./publish-form.scss；填写屏（2026-10-31 R7 改版）在 ./form-clean.scss，和创建活动、新增房源、线上任务发布共用 */
@import './publish-form.scss';
@import './form-clean.scss';
.staff-jobs{background:var(--k-bg)}button{margin:0;padding:0;border:0;background:transparent;line-height:1.2}.search-row{padding:5px 14px 11px;display:flex;gap:10px}.search-box{height:42px;min-width:0;flex:1;padding:0 12px;border:1px solid var(--k-line2);border-radius:8px;background:var(--k-paper);display:flex;align-items:center;gap:9px;color:var(--k-muted);font-size:13px}.filter-button{min-width:62px;padding:0 8px;display:flex;align-items:center;justify-content:center;border:1px solid var(--k-line2);border-radius:8px;background:var(--k-paper);font-family:var(--k-serif);font-size:15px;font-weight:700}.metrics{margin:3px 14px 9px;height:59px;border:1px solid var(--k-line2);border-radius:9px;background:var(--k-paper);display:flex}.metrics>view{flex:1;border-right:1px solid var(--k-line);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;font-size:11px}.metrics>view:last-child{border-right:0}.metrics>view text:last-child{font-size:20px;font-weight:700}.amber-text{color:#B36A20}.job-tabs{height:43px;margin:0 14px;border-bottom:1px solid var(--k-line);display:flex;align-items:center;justify-content:space-between;font-family:var(--k-serif);font-size:14px;font-weight:700}.job-tabs .active{height:41px;display:flex;align-items:center;border-bottom:2px solid var(--k-red);color:var(--k-red)}.job-list{padding:7px 14px 123px}.job-card{height:84px;padding:6px 0;border-bottom:1px solid var(--k-line);display:flex;gap:11px;box-sizing:border-box}.job-card>image{width:67px;height:67px;border-radius:7px}.job-main{min-width:0;flex:1;display:flex;flex-direction:column;justify-content:space-between}.job-main>view:first-child{display:flex;align-items:center;justify-content:space-between;gap:8px}.job-title{min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-family:var(--k-serif);font-size:14px;font-weight:700}.job-status{flex-shrink:0;padding:3px 7px;border-radius:5px;font-size:10px}.job-status.green{background:var(--k-green-soft);color:var(--k-green)}.job-status.amber{background:var(--k-ochre-soft);color:#B36A20}.job-status.gray{background:#EEEAE4;color:var(--k-muted)}.job-meta{overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-size:11px;color:var(--k-muted)}.job-stats{display:flex;justify-content:space-between;font-size:11px;color:var(--k-muted)}.job-stats text text{color:var(--k-ink);font-size:13px}.green-text{color:var(--k-green)!important}.list-actions{position:fixed;left:0;right:0;bottom:calc(66px + var(--k-safe-bottom));z-index:42;padding:10px 14px;background:var(--k-bg);display:flex;gap:9px}.list-actions button{height:45px;display:flex;align-items:center;justify-content:center;border-radius:8px;font-family:var(--k-serif);font-size:16px;font-weight:700}.list-actions button:first-child{width:113px;border:1px solid var(--k-red-line);color:var(--k-red)}.list-actions button:last-child{flex:1;background:var(--k-red);color:#fff}.list-actions button.off{opacity:.45}
/* 2026-11-03 主人：简化商家端。合作商家的卡片不定高，下面一排大按钮（高 44）：分享 / 暂停 / 恢复；待上架的写一句去向。只剩「发布岗位」一个钮时通栏实心 */
.job-card--merchant{height:auto;flex-wrap:wrap;padding:10px 0}.job-card--merchant .job-main{min-height:67px}.job-acts{flex-basis:100%;margin-top:10px;display:flex;align-items:center;gap:10px}.job-act{flex:1;height:44px;border:1px solid var(--k-red-line);border-radius:10px;background:var(--k-paper);display:flex;align-items:center;justify-content:center;font-family:var(--k-serif);font-size:16px;font-weight:700;color:var(--k-red)}.job-act--main{background:var(--k-red);border-color:var(--k-red);color:#fff}.job-acts__tip{font-size:14px;line-height:1.6;color:var(--k-muted)}
.list-actions button:only-child{width:auto;flex:1;border:0;background:var(--k-red);color:#fff}
/* 补填筛选条件弹层里的分段选择（性别、最短在店） */
.seg{height:40px;border:1px solid var(--k-line2);border-radius:8px;background:var(--k-paper);display:flex}.seg>text{flex:1;display:flex;align-items:center;justify-content:center;border-right:1px solid var(--k-line);font-size:13px}.seg>text:last-child{border-right:0}.seg .active{background:var(--k-red);color:#fff;border-radius:7px}.seg.three>text,.seg.five>text{font-size:13px;white-space:nowrap}
.insurance-hint{display:block;margin:7px 0 0;font-size:12px;line-height:1.6;color:var(--k-muted)}.insurance-hint--warn{color:var(--k-alert)}
.share-page{padding:0 14px calc(88px + var(--k-safe-bottom))}.share-card{border:1px solid var(--k-line2);border-radius:9px;background:var(--k-paper)}.share-title{display:block;font-family:var(--k-serif);font-size:15px;font-weight:700}.link-row{padding:12px 10px;display:flex;gap:10px}.link-row>text{height:35px;min-width:0;flex:1;padding:0 9px;border:1px solid var(--k-line2);border-radius:7px;display:block;line-height:33px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.link-row>button,.share-poster button{width:69px;height:35px;display:flex;align-items:center;justify-content:center;border:1px solid var(--k-red-line);border-radius:7px;color:var(--k-red);font-family:var(--k-serif);font-size:13px;font-weight:700}.link-row .share-title{position:absolute}.share-poster{padding:12px 10px;border-top:1px solid var(--k-line)}.share-poster>view{margin-top:10px;display:flex;align-items:center;gap:10px}.share-poster image{width:57px;height:57px;border-radius:6px}.share-poster>view>view{min-width:0;flex:1;display:flex;flex-direction:column;gap:8px}.share-poster>view>view text:first-child{font-family:var(--k-serif);font-size:14px;font-weight:700}.share-poster>view>view text:last-child{font-size:11px;color:var(--k-muted)}.track-title,.data-title>text:first-child,.rank-title{display:block;margin:14px 0 7px;font-family:var(--k-serif);font-size:15px;font-weight:700}.track-tabs{height:36px;border:1px solid var(--k-line2);border-radius:8px;background:var(--k-paper);display:flex}.track-tabs>text{flex:1;display:flex;align-items:center;justify-content:center;border-right:1px solid var(--k-line)}.track-tabs>text:last-child{border-right:0}.track-tabs .active{border-radius:7px;background:var(--k-red);color:#fff}.data-title{display:flex;align-items:center;justify-content:space-between}.data-title>text:last-child{color:var(--k-muted);font-size:10px}.data-table>view{height:29px;display:grid;grid-template-columns:1.4fr repeat(4,1fr);align-items:center;border-bottom:1px solid var(--k-line);font-size:12px}.data-table .thead{height:25px;color:var(--k-muted)}.data-table .total{font-family:var(--k-serif);font-size:15px;font-weight:700;color:var(--k-red-deep)}.rank-title{margin-top:14px}.rank-card{padding:5px 9px;border:1px solid var(--k-line2);border-radius:8px;background:var(--k-paper)}.rank-card>view{height:28px;display:grid;grid-template-columns:2.7fr repeat(3,.65fr);align-items:center;font-size:12px}.rank-head{color:var(--k-muted)}.rank-name{min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.rank-num{color:var(--k-red);font-weight:700}.full-rank{display:block;margin-top:12px;text-align:center;color:var(--k-red);font-family:var(--k-serif);font-size:14px;font-weight:700}
.chip-pop{position:fixed;inset:0;z-index:1000}.chip-pop__mask{position:absolute;inset:0;background:rgba(36,27,23,.45)}.chip-pop__panel{position:absolute;left:0;right:0;bottom:0;padding:18px 16px calc(16px + var(--k-safe-bottom));border-radius:20px 20px 0 0;background:var(--k-paper)}.chip-pop__head{display:flex;align-items:baseline;justify-content:space-between;gap:12px}.chip-pop__title{font-family:var(--k-serif);font-size:18px;font-weight:700}.chip-pop__hint{color:var(--k-muted);font-size:13px}.chip-pop__scroll{max-height:50vh;margin:16px 0 20px}.chip-pop__chips{display:flex;flex-wrap:wrap;gap:10px}.chip-pop__chip{padding:8px 14px;border:1px solid var(--k-line);border-radius:18px;font-size:14px;background:var(--k-bg)}.chip-pop__chip.on{color:#fff;border-color:var(--k-red);background:var(--k-red);font-weight:600}.chip-pop__chip--add{border-style:dashed;color:var(--k-red)}.chip-pop__foot{display:flex;gap:12px}.chip-pop__btn{flex:1;min-width:0}.chip-pop__btn--main{flex:2}
/* 补填筛选条件：顶上的提示条、卡片上的「待补条件」、弹层（选项区最高到屏幕高减去标题和按钮区，320×640 也露得出按钮） */
.cond-banner{margin:0 14px 9px;padding:9px 10px;border-radius:12px;background:var(--k-red-soft);display:flex;align-items:center;gap:8px}.cond-banner__text{min-width:0;flex:1;font-size:12px;line-height:1.5;color:var(--k-ink2)}.cond-banner__btn{flex-shrink:0;height:30px;padding:0 11px;border-radius:15px;background:var(--k-red);color:#fff;display:flex;align-items:center;font-size:13px;font-weight:700}
.job-cond{flex-shrink:0;margin-left:auto;padding:3px 6px;border-radius:5px;background:var(--k-red-soft);color:var(--k-red-deep);font-size:10px}
.cond-sheet .chip-pop__head{flex-direction:column;align-items:flex-start;gap:4px}.cond-sheet__job{max-width:100%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.cond-sheet .cond-sheet__scroll{max-height:calc(100vh - 210px);margin:10px 0 16px}.cond-sheet__label{display:block;margin:10px 0 6px;font-family:var(--k-serif);font-size:15px;font-weight:700}.cond-sheet__chips{gap:8px}.cond-sheet .chip-pop__chip{padding:7px 12px;font-size:13px}.cond-sheet .seg{height:36px}
/* 岗位照片（V49）：四列方格，第一张左下角写「封面」，右上角 × 删掉；最后一格「+」接着传（320 宽一格约 64px） */
.photo-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.photo-cell{position:relative;height:0;padding-bottom:100%;border-radius:8px;overflow:hidden;background:var(--k-paper2)}.photo-cell__img{position:absolute;left:0;top:0;width:100%;height:100%;display:block}.photo-cell__cover{position:absolute;left:0;bottom:0;padding:2px 6px;border-top-right-radius:8px;background:rgba(36,27,23,.62);color:#fff;font-size:11px}.photo-cell__del{position:absolute;top:3px;right:3px;width:20px;height:20px;border-radius:50%;background:rgba(36,27,23,.62);display:flex;align-items:center;justify-content:center}.photo-cell--add{border:1px dashed var(--k-line2);background:var(--k-paper);box-sizing:border-box}.photo-cell__add{position:absolute;left:0;top:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;color:var(--k-muted);font-size:11px}.photo-sheet .photo-grid{margin-top:4px}
/* 住宿与宠物弹层（R4）：里面的控件用填写页那一套 fc-*，和发布表单长得一样；白块、分隔线不要，每块之间留白 */
.extras-item{margin-top:18px}.extras-item:first-child{margin-top:4px}.extras-tip{margin-top:16px}
/* 2026-11-03 预设模板（第 1 步）、每组标题下的一句说明、底部「还差什么」：守 form-clean.scss 那几条（--k-* 颜色、强调色只用 --k-red-deep、不用渐变和描边、字号不小于 13、能点的不低于 44、圆角 8/12/16） */
.fc-group__sub{display:block;padding:0 16px 12px;font-size:14px;line-height:22px;color:var(--k-muted)}
.tpl-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding:0 16px 16px}
.tpl-card{min-width:0;min-height:64px;padding:10px 12px;box-sizing:border-box;border-radius:12px;background:var(--k-paper2);display:flex;flex-direction:column;justify-content:center;gap:2px}
.tpl-card--last{background:var(--k-red-soft)}
.tpl-card__t{font-size:15px;font-weight:600;line-height:21px;color:var(--k-ink)}
.tpl-card__s{font-size:13px;line-height:18px;color:var(--k-ink2);overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.tpl-card.on{background:var(--k-red-deep)}.tpl-card.on .tpl-card__t,.tpl-card.on .tpl-card__s{color:var(--k-paper)}
.tpl-done{display:flex;align-items:center;gap:8px;padding:0 16px 14px}.tpl-done__copy{flex:1;min-width:0}.tpl-done__t{display:block;font-size:16px;font-weight:600;line-height:24px;color:var(--k-ink)}.tpl-done__copy .fc-note{margin-top:2px}
.tpl-done__act{flex-shrink:0;min-height:44px;padding:0 12px;box-sizing:border-box;border-radius:12px;background:var(--k-paper2);display:flex;align-items:center;font-size:15px;font-weight:500;color:var(--k-red-deep)}
.fc-bar__todo{display:flex;align-items:center;justify-content:center;min-height:44px;margin-top:-8px;padding:0 4px;font-size:14px;line-height:20px;text-align:center;color:var(--k-red-deep)}.fc-bar__todo--err{color:var(--k-alert)}.fc-bar__todo--ok{color:var(--k-muted)}
/* 「还差」一行可能折两行：底部多留 20 */
.fc-form{padding-bottom:calc(128px + var(--k-safe-bottom))}
.gender-plan__modes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.gender-plan__counts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:12px}
.gender-plan__count{display:flex;align-items:center;gap:8px;min-width:0;min-height:48px;padding:0 12px;border-radius:12px;background:var(--k-paper2);font-size:16px;color:var(--k-ink)}
.gender-plan__input{flex:1;min-width:0;height:48px;text-align:center;font-size:18px;font-weight:600;color:var(--k-red-deep)}
</style>
