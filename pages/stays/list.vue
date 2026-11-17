<template>
  <k-feature-gate feature="stay-booking">
  <view class="k-page stays" :class="{ 'stays--entry': s === 1, 'stays--list': s === 2 }">
    <!-- 1 城市 / 日期 / 人数 搜索 -->
    <view v-if="s === 1">
      <k-topbar>
        <template #left>
          <view class="brand">
            <text class="brand__name k-display">袋鼠全球青年</text>
            <view class="brand__city" hover-class="k-press-s" @click="pickCity">
              <k-icon name="map-pin" :size="15" color="ink" :stroke="1.8" />
              <text class="brand__city-text">{{ state.city || (locating ? '定位中' : '全国') }}</text>
              <k-icon name="chevron-down" :size="14" color="ink" :stroke="2" />
            </view>
          </view>
        </template>
      </k-topbar>
      <!-- 入口只收集预订信息；房型、价格、评分等条件在房源列表中选择。 -->
      <view class="k-body k-pad-tab entry">
        <view class="sbox">
          <view class="sbox__head"><text class="sbox__title">预订信息</text></view>
          <view class="dpill">
            <view class="dpill__day" aria-role="button" aria-label="选择入住日期" hover-class="k-press" @click="pickDates('start')">
              <text class="booking-label">入住</text>
              <text class="sbox__big">{{ dayText(state.checkIn) }}</text><text class="sbox__wk">{{ weekText(state.checkIn) }}</text>
            </view>
            <view class="dpill__middle"><text class="dpill__nights">共{{ nights }}晚</text><k-icon name="arrow-right" :size="20" color="muted" :stroke="1.5" /></view>
            <view class="dpill__day dpill__day--end" aria-role="button" aria-label="选择离店日期" hover-class="k-press" @click="pickDates('end')">
              <text class="booking-label">离店</text>
              <text class="sbox__big">{{ dayText(state.checkOut) }}</text><text class="sbox__wk">{{ weekText(state.checkOut) }}</text>
            </view>
          </view>
          <view class="sbox__pair">
            <view class="cpill" hover-class="k-press" @click="pickGuests">
              <view class="cpill__body"><text class="booking-label">入住人数</text><text class="cpill__text">{{ state.guests }}人</text></view>
              <k-icon name="chevron-down" :size="16" color="muted" :stroke="1.8" />
            </view>
            <view class="cpill" hover-class="k-press" @click="pickAreaSheet">
              <view class="cpill__body"><text class="booking-label">目的地区域</text><text class="cpill__text sbox__area">{{ filter.district || filter.area || '全部区域' }}</text></view>
              <k-icon name="chevron-down" :size="16" color="muted" :stroke="1.8" />
            </view>
          </view>
          <view class="sbox__search">
            <k-icon name="search" :size="18" color="muted" :stroke="1.7" />
            <input v-model="kw" placeholder="搜索小院、商圈、配套设施" placeholder-class="k-placeholder" confirm-type="search" @confirm="search" />
            <view class="entry-search" hover-class="k-press" @click="search"><text>搜索</text></view>
          </view>
        </view>

        <view class="k-section" hover-class="k-press" @click="go('/pages/stays/travel?city='+encodeURIComponent(state.city||''))"><text class="k-section__title">旅游产品</text><view class="k-section__more"><text>查看线路与体验</text><k-icon name="chevron-right" :size="16" color="muted" /></view></view>
        <view v-if="recent.length" class="k-section recent"><text class="k-section__title">近期搜索</text><text class="k-small k-muted" @click="clearRecent">清空</text></view>
        <view v-if="recent.length" class="k-row k-gap10 recent-tags">
          <view v-for="t in recent" :key="t" class="tag" hover-class="k-press-s" @click="kw = t"><text>{{ t }}</text></view>
        </view>

        <view class="k-section areas"><view><text class="k-section__title">{{ previewNationwide ? '全国可租小院' : '可租小院' }}</text></view><view class="k-section__more" hover-class="k-press" @click="showAllPreviews"><text>查看全部</text><k-icon name="chevron-right" :size="14" color="muted" /></view></view>
        <view v-if="previewNotice" class="preview-notice"><k-icon name="map-pin" :size="14" color="muted" /><text>{{ previewNotice }}</text></view>
        <view v-if="previewLoading" class="entry-status"><text>正在寻找小院…</text></view>
        <view v-else-if="previewError" class="entry-status"><text>{{ previewError }}</text><view class="entry-status__action" hover-class="k-press" @click="init"><text>重新加载</text></view></view>
        <view v-else-if="!previews.length" class="entry-status"><text>暂时没有可展示的小院</text><text class="entry-status__hint">换个城市或日期，再找找喜欢的住处</text><view class="entry-status__action" hover-class="k-press" @click="pickCity"><text>看看其他城市</text></view></view>
        <view v-if="previews.length" class="k-grid-2 pv-grid" :class="{ 'pv-grid--single': previews.length === 1 }">
          <view v-for="h in previews" :key="h.stayId" class="pv" hover-class="k-press-s" @click="openDetail(h)">
            <view class="pv__pic">
              <image class="pv__img" :src="absUrl(h.img) || '/static/media/cover-empty.png'" mode="aspectFill" />
              <text class="pv__src">{{ h.src }}</text>
            </view>
            <view class="pv__body">
              <text class="pv__name">{{ h.name }}</text>
              <text v-if="previewNationwide && h.city" class="pv__location">{{ h.city }}</text>
              <view class="pv__meta"><template v-if="h.rate"><k-icon name="star" :size="11" color="#C99043" fill :stroke="1.4" /><text class="pv__score">{{ h.rate.score }}</text><text class="pv__sub">{{ h.rate.count }}</text></template><text v-else class="pv__sub">{{ h.sub || '暂无评价' }}</text></view>
              <view class="k-row pv__price"><text class="yen">¥</text><text class="pv__num">{{ h.price }}</text><text class="home__unit">{{ h.priceLabel }}</text></view><text v-if="h.periodText" class="stay-period-options">{{ h.periodText }}</text>
            </view>
          </view>
        </view>
      </view>
      <k-tabbar v-if="!dateOpen" active="home" />
      <!-- 入住日期之前要手打 yyyy-MM-dd，后来改成日历选入住日 + 菜单选住几晚；2026-10-17 改成一个区间日历：点入住、点离店，最多 30 晚。
           入住最晚到今天 + 180（和下单接口「最多提前 180 天预订」一致，之前写的是 179），离店最晚到入住 + 30 -->
      <stay-range-picker v-if="dateOpen" :initial-field="dateField" :start="state.checkIn" :end="state.checkOut" :today="todayCn()" :min-date="todayCn()" :max-start="shiftDate(todayCn(), 180)" @cancel="dateOpen = false" @confirm="confirmDates" />
    </view>

    <!-- 2 房源列表（2026-10-17 改版，效果图 6）：标题「城市 + 房源」，顶部搜索框 + 位置 / 价格 / 房型 / 排序四个下拉，
         点开在下面展开面板（之前位置 / 价格 / 房型都跳到整页「筛选排序」，排序是系统菜单）；整页筛选还在，右边「更多筛选」进 -->
    <view v-else-if="s === 2">
      <!-- 2026-10-19 一比一还原（参考图 8）：标题「‹ 大理房源」靠左、超粗大字（不再居中小字）；搜索胶囊白底细描边，暖棕「搜索」按钮收进胶囊右侧 -->
      <k-topbar back custom-back @back="s = 1">
        <template #left><text class="ltitle k-display" :class="{ 'ltitle--long': listTitle.length > 8 }">{{ listTitle }}</text></template>
        <view class="lbar">
          <view class="k-row lbar__search">
            <view class="lsearch"><k-icon name="search" :size="17" color="muted" :stroke="1.8" /><input class="lsearch__input" v-model="kw" placeholder="搜索小院名称、商圈、配套设施" placeholder-class="k-placeholder" confirm-type="search" @confirm="searchInList" /><view class="lsearch__btn" hover-class="k-press-s" @click="searchInList"><text>搜索</text></view></view>
          </view>
          <view class="filters">
            <view v-for="f in filterBar" :key="f.key" class="filters__item" :class="{ open: dd === f.key, set: f.set }" role="button" :aria-label="f.text" :aria-expanded="dd === f.key" hover-class="k-press" @click="toggleDd(f.key)"><text class="filters__text">{{ f.text }}</text><k-icon :name="dd === f.key ? 'chevron-up' : 'chevron-down'" :size="13" :color="dd === f.key ? 'white' : (f.set ? 'red' : 'ink')" :stroke="1.8" /></view>
          </view>
          <view v-if="dd" class="dd-mask" @click="dd = ''" @touchmove.stop.prevent="noop" />
          <view v-if="dd" class="dd" :class="{ 'dd--room': dd === 'room', 'dd--location': dd === 'area' }">
            <!-- 位置（2026-10-17 R2）：「全部位置」+ 这座城市有房源的区县（带家数，/app/stay/districts）；房源上填过商圈的再列一组「商圈」。
                 区县和商圈二选一（同时选容易一家都没有）；都没有时只有「全部位置」+ 一句说明 -->
            <view v-if="dd === 'area'">
              <text class="dd__title">{{ state.city }} · 位置</text>
              <text v-if="areasLoading" class="dd__empty">正在加载本城位置…</text>
              <text v-if="areasError" class="dd__retry" @click="loadAreas">{{ areasError }}</text>
              <text class="dd__sub">区县</text>
              <view class="grid12">
                <view v-for="(o, i) in districtOpts" :key="'d' + o.value" class="opt" :class="{ on: o.value ? filter.district === o.value : (!filter.district && !filter.area) }" :style="'grid-column: span ' + districtSpans[i]" hover-class="k-press-s" @click="applyDistrict(o.value)"><text>{{ o.label }}</text></view>
              </view>
              <template v-if="areaRows.length">
                <text class="dd__sub dd__sub--gap">商圈</text>
                <view class="grid12">
                  <view v-for="(o, i) in areaChoices" :key="'a' + o.value" class="opt" :class="{ on: filter.area === o.value }" :style="'grid-column: span ' + areaSpans[i]" hover-class="k-press-s" @click="applyArea(o.value)"><text>{{ o.label }}</text></view>
                </view>
              </template>
              <text v-if="!areasLoading && !areasError && !districtRows.length && !areaRows.length" class="dd__empty">这个城市的房源还没有细分区域，先看全部位置</text>
            </view>
            <view v-else-if="dd === 'price'">
              <text class="dd__title">价格（每晚）</text>
              <view class="grid12 grid12--price">
                <view v-for="(o, i) in priceOpts" :key="o" class="opt" :class="{ on: filter.price === o }" :style="'grid-column: span ' + priceSpans[i]" hover-class="k-press-s" @click="applyPrice(o)"><text>{{ o }}</text></view>
              </view>
            </view>
            <!-- 两处筛选共用原稿中的五种选择：第一行三项、第二行两项，均铺满。 -->
            <view v-else-if="dd === 'room'" class="room-panel">
              <view class="k-between room-panel__head"><text class="dd__title">房型</text><text class="dd__reset" hover-class="k-press" @click="resetDraft">重置</text></view>
              <scroll-view scroll-y class="room-panel__body"><view class="room-panel__options">
              <text class="dd__sub">房型选择</text>
              <view class="gcols gcols--room">
                <view v-for="o in roomOpts" :key="o" class="opt" :class="{ on: draft.room === o }" hover-class="k-press-s" @click="draft.room = o"><text>{{ o }}</text></view>
              </view>
              <view class="dd__line" />
              <text class="dd__sub">卫浴选择</text>
              <view class="gcols gcols--3">
                <view v-for="o in bathOpts" :key="o" class="opt" :class="{ on: draft.bath === o }" hover-class="k-press-s" @click="draft.bath = o"><text>{{ o }}</text></view>
              </view>
              <text class="dd__sub">配套设施</text>
              <view class="gcols gcols--5">
                <view v-for="(f, i) in PANEL_FACS" :key="f.label" class="opt" :style="'grid-column: span ' + panelFacSpans[i]" :class="{ on: draftFacOn(f) }" hover-class="k-press-s" @click="toggleDraftFac(f)"><text>{{ f.label }}</text></view>
              </view>
              </view></scroll-view>
              <view class="room-panel__footer"><view class="dd__ok" hover-class="k-press-s" @click="applyDraft"><text>确定</text></view></view>
            </view>
            <view v-else>
              <view v-for="o in SORT_OPTS" :key="o[0]" class="dd__row" :class="{ on: sort === o[0] }" hover-class="k-press" @click="applySort(o[0])"><text>{{ o[1] }}</text><k-icon v-if="sort === o[0]" name="check" :size="16" color="red" :stroke="2.2" /></view>
            </view>
          </view>
        </view>
      </k-topbar>
      <view class="k-body k-pad-tab">
        <view class="src-row">
          <view class="k-row k-gap6 src-tabs">
            <view v-for="t in srcTabs" :key="t.key" class="pill" :class="{ on: src === t.key }" hover-class="k-press-s" @click="setSrc(t.key)"><text>{{ t.label }}</text><text class="pill__n">{{ t.count }}</text></view>
          </view>
          <view class="more-filter" hover-class="k-press" @click="s = 4"><k-icon name="sliders-horizontal" :size="14" color="ink" :stroke="1.8" /><text>更多筛选</text></view>
        </view>
        <!-- 列表卡（效果图 6）：左图；右边名称 + 收藏心、来源 / 安心住标签、「4.8分 127条评价」、地址、「可订 10.17-10.18」+ 大号「¥168起」、底部一行小标签
             2026-10-18：标签行加上「可订」（订不了时写原因：满房 / 余量不足 / 超出可住人数），评分前面一颗星；底部小标签做成浅色小胶囊 -->
        <view v-for="h in homes" :key="h.stayId" class="home" hover-class="k-press-s" @click="openDetail(h)">
          <view class="home__pic">
            <image class="home__img" :src="absUrl(h.img) || '/static/media/cover-empty.png'" mode="aspectFill" />
          </view>
          <view class="k-flex1 home__body">
            <view class="k-between k-gap8"><text class="home__name home__name--one">{{ h.name }}</text><view class="home__fav" hover-class="k-press-s" @click.stop="toggleFav(h)"><k-icon name="heart" :size="20" :color="h.favorite ? 'red' : 'ink'" :fill="h.favorite" :stroke="1.6" /></view></view>
            <view class="k-row k-gap6 k-mt8 home__tags"><view class="chip chip--src" :class="{ 'chip--co': h.src !== '袋鼠直营' }"><text>{{ h.src }}</text></view><view v-if="h.dates" class="chip" :class="h.available ? 'chip--ok' : 'chip--off'"><text>{{ h.availText }}</text></view><view v-if="h.safeCert" class="chip chip--safe"><text>安心住</text></view></view>
            <view class="k-row k-gap4 k-mt8 home__rate"><template v-if="h.rate"><k-icon name="star" :size="12" color="#C99043" fill :stroke="1.4" /><text class="home__score">{{ h.rate.score }}</text><text class="home__meta">{{ h.rate.count }}</text></template><text v-else class="home__meta">暂无评价</text></view>
            <text v-if="h.where" class="home__meta home__where k-mt4">{{ h.where }}</text>
            <view class="k-between k-mt8 home__foot">
              <view class="k-row k-gap6 home__avail"><text class="k-green avail" :style="h.available ? '' : 'color: var(--k-muted)'">{{ h.availText }}</text><text class="k-small k-muted">{{ h.dates }}</text></view>
              <view class="k-row home__price"><text class="yen">¥</text><text class="price">{{ h.price }}</text><text class="home__unit">{{ h.priceLabel }}</text></view><text v-if="h.periodText" class="stay-period-options">{{ h.periodText }}</text>
            </view>
            <view v-if="h.tags.length" class="home__tagline"><text v-for="t in h.tags" :key="t" class="home__tag">{{ t }}</text></view>
          </view>
        </view>
        <view v-if="listError" class="list-empty"><text>{{ listError }}</text><view class="list-empty__btn" @click="loadList(homes.length > 0)"><text>重新加载</text></view></view>
        <text v-else-if="listLoading" class="list-loading">正在查找{{ state.city }}的小院…</text>
        <view v-else-if="listLoaded && !homes.length" class="list-empty"><text>没有符合条件的房源</text><text class="list-empty__sub">换个日期、关键词或放宽筛选再试试</text><view class="list-empty__btn" hover-class="k-press-s" @click="s = 4"><text>调整筛选</text></view></view>
        <text v-else-if="homes.length && !hasMore" class="list-end">已经是全部房源了</text>
      </view>
      <!-- 10-19 复查：下拉面板开着时先收起底栏 —— 面板在顶栏里、层级比底栏低，矮一点的手机上「房型」面板底部的「确定」会被底栏盖住 -->
      <k-tabbar v-if="!dd" active="home" />
    </view>

    <!-- 3 早鸟特价 -->
    <view v-else-if="s === 3">
      <k-topbar title="早鸟特价" back custom-back @back="backFromPromo" />
      <view class="k-body k-pad-tab">
        <view class="k-between bird-head">
          <text class="bird-head__title">提前预订，价格更优</text>
          <view class="k-row k-gap4">
            <text class="k-small k-muted">剩余</text><view class="tbox"><text>{{ countdown.d }}</text></view><text class="k-small k-muted">天</text>
            <view class="tbox"><text>{{ countdown.h }}</text></view><text class="tsep">:</text><view class="tbox"><text>{{ countdown.m }}</text></view><text class="tsep">:</text><view class="tbox"><text>{{ countdown.s }}</text></view>
          </view>
        </view>
        <view v-for="b in birds" :key="b.promoId" class="bird" hover-class="k-press-s" @click="openPromo(b)">
          <view class="bird__pic">
            <image class="bird__img" :src="absUrl(b.img) || '/static/media/cover-empty.png'" mode="aspectFill" />
            <view class="badges"><view class="badge badge--src"><text>{{ b.src }}</text></view><view v-if="b.safeCert" class="badge badge--safe"><text>安心住</text></view></view>
          </view>
          <view class="k-flex1">
            <text class="home__name">{{ b.name }}</text>
            <text class="home__meta k-mt8">{{ b.where }}</text>
            <view class="bird__price k-mt12">
              <text class="strike">¥{{ b.old }}</text>
              <text class="yen">¥</text><text class="price">{{ b.price }}</text><text class="home__unit">/晚起</text>
            </view>
            <text class="bird__left k-mt4">仅剩 {{ b.left }} 间</text>
            <view class="bird__line" />
            <text class="home__meta">适用入住日：{{ b.range }}</text>
            <view class="k-row k-gap16 k-mt8">
              <view v-if="!b.refundable" class="k-row k-gap6"><view class="k-circle k-circle--red mark"><k-icon name="x" :size="10" color="white" :stroke="3" /></view><text class="k-small k-muted">不可退</text></view>
              <view v-if="b.refundable" class="k-row k-gap6"><view class="k-circle k-circle--green mark"><k-icon name="check" :size="10" color="white" :stroke="3" /></view><text class="k-small k-muted">可取消</text></view>
            </view>
          </view>
        </view>
        <view v-if="promoLoaded && !birds.length" class="list-empty"><text>当前城市暂无早鸟特价</text><text class="list-empty__sub">有新的早鸟房源上架时会显示在这里</text></view>
      </view>
      <k-tabbar active="home" />
    </view>

    <!-- 4 筛选排序 -->
    <view v-else>
      <k-topbar title="筛选排序" back custom-back @back="s = 2" />
      <view class="k-body k-pad-bottom filter">
        <view class="fcard">
          <view class="k-between"><text class="fcard__title">{{ state.city }} · 位置</text><text class="k-small k-muted">{{ areaFilterText }}</text></view>
          <image v-if="mapUrl" class="map" :src="mapUrl" mode="aspectFill" />
          <!-- 之前点开是分页菜单（下一页…），商圈多时要一页页翻；现在直接在卡片里点选 -->
          <!-- 区县（2026-10-17 R2）和商圈放在同一组里点选，二选一 -->
          <view v-if="areaRows.length || districtRows.length" class="opts opts--3 opts--tight location-grid">
            <view class="opt" :class="{ on: !filter.area && !filter.district }" hover-class="k-press-s" @click="pickPlace('', '')"><text>不限</text></view>
            <view v-for="d in districtRows" :key="'d' + d.name" class="opt" :class="{ on: filter.district === d.name }" hover-class="k-press-s" @click="pickPlace(d.name, '')"><text>{{ d.name }}<text v-if="d.count > 0">（{{ d.count }}）</text></text></view>
            <view v-for="a in areaRows" :key="a.area" class="opt" :class="{ on: filter.area === a.area }" hover-class="k-press-s" @click="pickPlace('', a.area)"><text>{{ a.area }}（{{ a.count }}）</text></view>
          </view>
        </view>
        <view class="fcard">
          <view class="k-row k-gap6"><text class="fcard__title">价格区间</text><text class="k-meta">（每晚）</text></view>
          <view class="opts opts--4">
            <view v-for="o in priceOpts" :key="o" class="opt" :class="{ on: price === o }" hover-class="k-press-s" @click="price = o"><text>{{ o }}</text></view>
          </view>
        </view>
        <view class="fcard">
          <text class="fcard__title">房型设施</text>
          <text class="fcard__sub fcard__sub--top">房型</text>
          <view class="opts opts--room opts--tight">
            <view v-for="o in roomOpts" :key="o" class="opt" :class="{ on: room === o }" hover-class="k-press-s" @click="room = o"><text>{{ o }}</text></view>
          </view>
          <text class="fcard__sub fcard__sub--top">卫浴</text>
          <view class="opts opts--3 opts--tight">
            <view v-for="o in bathOpts" :key="o" class="opt" :class="{ on: bath === o }" hover-class="k-press-s" @click="bath = o"><text>{{ o }}</text></view>
          </view>
          <text class="fcard__sub fcard__sub--top">设施</text>
          <view class="fac-grid">
            <view v-for="(f, i) in facilities" :key="f.label" class="fac-chip" :style="'grid-column: span ' + facGridSpans[i]" :class="{ on: facOn(f) }" hover-class="k-press-s" @click="toggleFac(f)"><k-icon :name="f.icon" :size="16" :color="facOn(f) ? 'red' : 'ink'" :stroke="1.6" /><text class="fac-chip__label">{{ f.label }}</text></view>
          </view>
          <view class="fac-row fac-row--checks">
            <view v-for="c in checks" :key="c.label" class="k-row k-gap8 fac-check" hover-class="k-press" @click="c.on = !c.on">
              <view class="k-circle ck" :class="{ on: c.on }"><k-icon v-if="c.on" name="check" :size="12" color="white" :stroke="3" /></view>
              <text class="fac-check__label">{{ c.label }}</text>
            </view>
          </view>
        </view>
        <view class="fcard">
          <text class="fcard__title">房源来源</text>
          <view class="opts opts--3">
            <view v-for="o in srcOpts" :key="o" class="opt" :class="{ on: source === o }" hover-class="k-press-s" @click="source = o"><text>{{ o }}</text></view>
          </view>
        </view>
        <view class="fcard">
          <text class="fcard__title">评分与距离</text>
          <text class="fcard__sub fcard__sub--top">评分</text>
          <view class="opts opts--4 opts--tight">
            <view v-for="o in scoreOpts" :key="o" class="opt" :class="{ on: score === o }" hover-class="k-press-s" @click="score = o"><text>{{ o }}</text></view>
          </view>
          <text class="fcard__sub fcard__sub--top">距离景点</text>
          <view class="opts opts--4 opts--tight">
            <view v-for="o in distOpts" :key="o" class="opt" :class="{ on: dist === o }" hover-class="k-press-s" @click="dist = o"><text>{{ o }}</text></view>
          </view>
        </view>
      </view>
      <k-bottom flat><view class="foot-reset" hover-class="k-press" @click="reset"><text>重置</text></view><view class="foot-main"><k-button block @click="applyFilter">查看 {{ previewTotal }} 家</k-button></view></k-bottom>
    </view>
  </view>
</k-feature-gate>
</template>

<script setup>
import { periodDisplay } from './period-price.js'
import { stayBookingEnabled, refreshFeatures } from '@/common/features.js'
import { watch as watchStayGate } from 'vue'
import { publicShare, shareWithCover, timelineShare, showPublicShareMenu } from '@/common/public-share.js'
import { selectCity } from '@/common/city-picker.js'
import { locateCity } from '@/common/locate.js'
// ---------------------------------------------------------------------------
// 旅居搜索与房源列表接入情况：
//   s=1 城市（apiStayCities）、入住/离店与人数（本机搜索条件）、区域（apiStayAreas）、近期搜索（本机）、
//       可租小院（apiStayList 取当前城市第一页 4 条，2026-10-17）
//   s=2 房源列表（apiStayList：来源计数、日期内可订与起价都由服务端按房态算，分页加载）；
//       位置 / 价格 / 房型 / 排序是标题下的下拉面板（2026-10-17），条件和 s=4 是同一份 filter
//   s=3 早鸟特价（apiStayPromos，倒计时按服务端截止时间），可退 / 不可退只显示真实的那一个
//   s=4 筛选：价格、房型、设施、可做饭 / 长住优惠 / 带厨房、来源、评分、距景点距离全部是真实筛选条件；
//       没有接地图服务，所以不放地图预览图，位置按商圈筛
// ---------------------------------------------------------------------------
import { absUrl } from '@/common/upload.js'
import { ref, reactive, computed, watch, onUnmounted } from 'vue'
import { onReachBottom, onShareAppMessage, onShareTimeline, onShow } from '@dcloudio/uni-app'
import { useScreen, go, back, toast } from '@/common/screen.js'
import { apiStayCities, apiStayAreas, apiStayList, apiStayPromos, apiStayFavorite } from '@/common/api.js'
import { errText, sheet, yuan, shiftDate, pad2, serverTs, todayCn } from '@/common/ui.js'
import { stayState, normalizeDates, saveStayState, nightsBetween, dayText, weekText, dotText } from './stays-state.js'
import { cityTitle, srcLabel, evenSpans, ratingParts, dateRange, districtChoices, whereLine, cityDistricts } from './stays-ui.js'
import R from '@/common/routes.js'
// 入住 / 离店区间日历（2026-10-17）：旅居分包里的组件，显式引入，不进主包
import StayRangePicker from './components/stay-range-picker.vue'
// 区县接口只有这一页用（2026-10-17 R2）：直接在分包里调，不往主包的 common/api.js 里加（主包只剩约 100KB）
import { get } from '@/common/request.js'
const apiStayDistricts = (city) => get('/app/stay/districts', { city })

let promoEntry = false
let explicitDestination = false
let locationAttempted = false
let locationVersion = 0
let disposed = false
const locating = ref(false)
// 显式目的地优先；普通入口按当前位置加载，不再把缓存或房源目录首城当定位。
const s = useScreen(4, {
  onLoad: (q) => {
    const city = String(q?.city || '').trim()
    explicitDestination = !!city
    stayState.city = city
    if (q?.view === 'promo') { s.value = 3; promoEntry = true }
    if (q?.keyword) { try { kw.value = decodeURIComponent(q.keyword) } catch (e) { kw.value = q.keyword } }
    init()
  }
})
watch(s, (v) => {
  dd.value = ''
  if (v === 2 && !homes.value.length) loadList()
  if (v === 3) loadPromos()
})
const state = stayState
const nights = computed(() => nightsBetween(state.checkIn, state.checkOut))

async function init() {
  if(!(await refreshFeatures()).stayBookingEnabled) return
  normalizeDates()
  saveStayState()
  loadAreas()
  loadPreviews()
  if (s.value === 2) loadList()
  if (s.value === 3) loadPromos()
  // 定位等待期间先显示全国房源，不让授权弹窗或定位失败挡住房源。
  if (!explicitDestination && !locationAttempted) locateDestination()
  try { cityList.value = (await apiStayCities()).data || [] } catch (e) { cityList.value = [] }
}

async function locateDestination() {
  locationAttempted = true
  const version = ++locationVersion
  locating.value = true
  let timer
  try {
    const city = await Promise.race([
      Promise.resolve().then(() => locateCity()).catch(() => null),
      new Promise(resolve => { timer = setTimeout(() => resolve(null), 8000) })
    ])
    if (disposed || version !== locationVersion) return
    locating.value = false
    const name = String(city?.name || '').trim()
    if (!name) return
    state.city = name
    filter.area = ''; filter.district = ''
    saveStayState()
    loadAreas(); loadPreviews()
    if (s.value === 2) loadList()
    if (s.value === 3) loadPromos()
  } finally {
    clearTimeout(timer)
    if (version === locationVersion) locating.value = false
  }
}
function keepSelectedDestination() {
  explicitDestination = true
  locationVersion++
  locating.value = false
}
onUnmounted(() => { disposed = true; locationVersion++ })

// ---------------- s=1 搜索 ----------------
const kw = ref('')
const cityList = ref([])
const RECENT_KEY = 'kangaroo:stays-recent'
const readRecent = () => { try { return (uni.getStorageSync(RECENT_KEY) || []).slice(0, 8) } catch (e) { return [] } }
const recent = ref(readRecent())
const clearRecent = () => {
  try { uni.removeStorageSync(RECENT_KEY) } catch (e) { /* 清不掉也不影响搜索 */ }
  recent.value = []
  toast('已清空')
}
const areaRows = ref([])
// 正式区县目录 + 该城市线上房源填写的商圈。旧城市的迟到响应不覆盖新选择。
const districtRows = ref([])
const districtAll = ref(0)
const areasLoading = ref(false)
const areasError = ref('')
let areaSeq = 0
let directoryRequest
function loadCityDirectory() {
  if (!directoryRequest) directoryRequest = get('/app/cities').then(r => r.data?.all || []).catch(e => { directoryRequest = null; throw e })
  return directoryRequest
}
async function loadAreas() {
  const seq = ++areaSeq, city = state.city
  areaRows.value = []
  districtRows.value = []
  districtAll.value = 0
  areasError.value = ''
  areasLoading.value = !!city
  if (!city) return
  const [areas, districts, directory] = await Promise.allSettled([apiStayAreas(city), apiStayDistricts(city), loadCityDirectory()])
  if (seq !== areaSeq || city !== state.city) return
  areaRows.value = areas.status === 'fulfilled' ? areas.value.data || [] : []
  const d = districts.status === 'fulfilled' ? districts.value.data || {} : {}
  districtRows.value = cityDistricts(city, directory.status === 'fulfilled' ? directory.value : [], d.districts || [])
  districtAll.value = Number(d.all) || 0
  areasLoading.value = false
  if (areas.status === 'rejected' || districts.status === 'rejected' || directory.status === 'rejected') areasError.value = '部分位置加载失败，点击重试'
}
// 区县和商圈二选一：选一个就清掉另一个（同时选容易一家都没有）
function pickPlace(district, area) {
  filter.district = district || ''
  filter.area = district ? '' : (area || '')
}
// 「区域」格（2026-10-17）：原来的「推荐区域」大图格子并进预订信息卡。区域 = 区县（R2）+ 房源上填的商圈，这个城市都没有时只能搜全部
async function pickAreaSheet() {
  if (areasLoading.value) return toast('位置正在加载，请稍候')
  const city = state.city
  if (!areaRows.value.length && !districtRows.value.length) return toast('这个城市的房源还没有细分区域，会搜全部位置')
  const items = [{ d: '', a: '' }].concat(districtRows.value.map(d => ({ d: d.name, n: d.count })), areaRows.value.map(a => ({ a: a.area, n: a.count })))
  const i = await sheet(items.map((x, k) => (k === 0 ? '全部区域' : `${x.d || x.a}${x.n > 0 ? `（${x.n}家）` : ''}`)))
  if (i < 0 || city !== state.city) return
  pickPlace(items[i].d, items[i].a)
}
async function pickCity() {
  const list = cityList.value
  const value = await selectCity({ value: state.city, allowAll: true, items: list.map(c => ({ name: c.city, note: `${c.count} 家线上房源` })), hint: '可选择目的地，或查看全国房源', emptyText: '暂无上线房源的城市' })
  if (value === null) return
  keepSelectedDestination()
  // 换了城市，上一个城市的商圈不再适用
  if (value !== state.city) { filter.area = ''; filter.district = '' }
  state.city = value
  saveStayState()
  loadAreas()
  loadPreviews()
  if (s.value === 2) loadList()
}
// 先查定位/选择城市，无房源时查全国；日期和人数保持不变。网络错误不冒充空库存。
const previewRows = ref([])
const previewLoading = ref(true)
const previewError = ref('')
const previewNationwide = ref(false)
const previewNotice = computed(() => {
  if (locating.value && !state.city) return '正在定位，先看看全国小院'
  if (!previewNationwide.value || previewLoading.value || previewError.value) return ''
  return state.city ? `${state.city}暂无上线房源，为你推荐全国小院` : '为你展示全国房源，可切换城市选择目的地'
})
let previewSeq = 0
async function loadPreviews() {
  const my = ++previewSeq
  const city = state.city
  const query = { checkIn: state.checkIn, checkOut: state.checkOut, guests: state.guests, pageNum: 1, pageSize: 6 }
  previewRows.value = []
  previewError.value = ''
  previewLoading.value = true
  previewNationwide.value = !city
  try {
    let d = (await apiStayList({ ...query, city: city || undefined })).data || {}
    if (my !== previewSeq) return
    if (city && !(d.rows || []).length) {
      d = (await apiStayList(query)).data || {}
      if (my !== previewSeq) return
      previewNationwide.value = true
    }
    if (my === previewSeq) previewRows.value = d.rows || []
  } catch (e) {
    if (my === previewSeq) previewError.value = '小院加载失败，请重试'
  } finally {
    if (my === previewSeq) previewLoading.value = false
  }
}
const previews = computed(() => previewRows.value.map(h => ({
  stayId: h.stayId, name: h.stayName, city: h.city, img: h.cover, price: h.displayPriceFen == null ? '--' : yuan(h.displayPriceFen), priceLabel: h.displayPriceLabel || '7晚参考价起', ...periodDisplay(h, true), src: srcLabel(h.operateMode),
  rate: ratingParts(h.rating, h.reviewCount), sub: whereLine(h.district, h.areaDesc) || (h.tags || []).slice(0, 2).join(' · ')
})))
const dateOpen = ref(false)
const dateField = ref('start')
const pickDates = (field = 'start') => { dateField.value = field; dateOpen.value = true }
// 区间日历点了「确定（共N晚）」：入住、离店一起换（晚数上限 30 由日历本身把关）
function confirmDates(r) {
  dateOpen.value = false
  if (!r || !r.start || !r.end) return
  state.checkIn = r.start
  state.checkOut = r.end
  normalizeDates()
  saveStayState()
  loadPreviews()
}
async function pickGuests() {
  const i = await sheet(['1人', '2人', '3人', '4人', '5人', '6人'])
  if (i < 0) return
  state.guests = i + 1
  saveStayState()
  loadPreviews()
}
const rememberKw = () => {
  const t = kw.value.trim()
  if (!t) return
  recent.value = [t].concat(recent.value.filter(x => x !== t)).slice(0, 8)
  try { uni.setStorageSync(RECENT_KEY, recent.value) } catch (e) { /* 近期搜索只是便利 */ }
}
// 区域现在是预订信息卡里选的（2026-10-17），搜索时照选的区域查，不再清掉
function search() {
  keepSelectedDestination()
  // 无本城房源时，默认搜索继续浏览刚刚展示的全国房源；明确关键词/区域仍遵循用户条件。
  if (previewNationwide.value && !previewLoading.value && !previewError.value && !kw.value.trim() && !filter.area && !filter.district) useNationwide()
  rememberKw()
  s.value = 2
  loadList()
}
function useNationwide() {
  state.city = ''
  filter.area = ''; filter.district = ''
  saveStayState()
  loadAreas()
}
function showAllPreviews() {
  keepSelectedDestination()
  if (previewNationwide.value) useNationwide()
  kw.value = ''
  resetDraft()
  reset()
  sort.value = ''
  src.value = 'all'
  s.value = 2
  loadList()
}

// ---------------- s=2 列表 ----------------
const listTitle = computed(() => cityTitle(state.city))
const counts = ref({ all: 0, direct: 0, managed: 0 })
// 来源页签：全部 / 袋鼠直营 / 袋鼠合作（2026-10-17 主人改名，原来是 直营 / 代运营；「袋鼠合作」查的是不是直营的全部，含加盟）
const srcTabs = computed(() => [
  { key: 'all', label: '全部', count: counts.value.all || 0 },
  { key: 'direct', label: srcLabel('direct'), count: counts.value.direct || 0 },
  { key: 'agent', label: srcLabel('managed'), count: counts.value.managed || 0 }
])
const src = ref('all')
watch(src, () => loadList())
// 页签和「筛选排序」里的「房源来源」是同一个条件：点页签同步改筛选里的来源。
// 之前点「全部」只改页签，列表仍按筛选里选过的「直营 / 代运营」过滤，和页签上的数量对不上
const SRC_OF = { all: '不限', direct: '袋鼠直营', agent: '袋鼠合作' }
const setSrc = (k) => { filter.source = SRC_OF[k]; src.value = k }
const rows = ref([])
const pageNum = ref(1)
const hasMore = ref(false)
const sort = ref('')
const homes = computed(() => rows.value.map(h => ({
  stayId: h.stayId, name: h.stayName, src: srcLabel(h.operateMode), img: h.cover, tags: (h.tags || []).slice(0, 3), where: whereLine(h.district, h.areaDesc),
  rate: ratingParts(h.rating, h.reviewCount), price: h.displayPriceFen == null ? '--' : yuan(h.displayPriceFen), priceLabel: h.displayPriceLabel || '7晚参考价起', ...periodDisplay(h, true), availText: h.availText, available: h.available, safeCert: h.safeCert,
  favorite: h.favorite, dates: h.dateText ? dateRange(dotText(state.checkIn), dotText(state.checkOut)) : ''
})))
// 列表卡右上角的收藏心（之前只是显示，点了进详情）：直接收藏 / 取消，和详情页同一个接口
async function toggleFav(h) {
  const next = !h.favorite
  try {
    const res = await apiStayFavorite(h.stayId, next)
    rows.value = rows.value.map(r => (r.stayId === h.stayId ? { ...r, favorite: next } : r))
    toast(res.msg || (next ? '已收藏' : '已取消收藏'))
  } catch (e) {
    toast(errText(e, '请先登录'))
  }
}
function searchInList() {
  rememberKw()
  dd.value = ''
  loadList()
}

// 四个下拉：当前展开哪一个（area / price / room / sort，空 = 都收起）。胶囊上固定写「位置 / 价格 / 房型 / 排序」（和效果图一样），
// 选了条件的棕字加粗、展开的暖棕实心；不写选中的值：320 宽时「女生多人间」「¥100–200」会被省略成「女…」，反而看不懂
const dd = ref('')
const noop = () => {}
const SORT_OPTS = [['', '综合推荐'], ['price_asc', '每晚价从低到高'], ['price_desc', '每晚价从高到低'], ['rating', '评分最高']]
const filterBar = computed(() => [
  { key: 'area', text: '位置', set: !!filter.area || !!filter.district },
  { key: 'price', text: '价格', set: filter.price !== '不限' },
  { key: 'room', text: '房型', set: filter.room !== '不限' || filter.bath !== '不限' || panelFacCount() > 0 },
  { key: 'sort', text: '排序', set: !!sort.value }
])
function toggleDd(key) {
  if (dd.value === key) { dd.value = ''; return }
  if (key === 'room') openDraft()
  dd.value = key
}
// 位置面板（2026-10-17 R2）：第一组「全部位置」+ 区县，第二组商圈（只在房源填过商圈时出现）；每组各自排满不留空洞
const districtOpts = computed(() => districtChoices(districtRows.value, districtAll.value))
const districtSpans = computed(() => evenSpans(districtOpts.value.length, districtOpts.value.some(o => o.label.length > 7) ? 2 : 3))
const areaChoices = computed(() => areaRows.value.map(a => ({ value: a.area, label: `${a.area}(${a.count})` })))
const areaSpans = computed(() => evenSpans(areaChoices.value.length, areaChoices.value.some(o => o.label.length > 7) ? 2 : 3))
const priceSpans = computed(() => evenSpans(priceOpts.length, 4))
const applyDistrict = (v) => { pickPlace(v, ''); dd.value = ''; loadList() }
const applyArea = (v) => { pickPlace('', v); dd.value = ''; loadList() }
const applyPrice = (v) => { filter.price = v; dd.value = ''; loadList() }
const applySort = (v) => { sort.value = v; dd.value = ''; loadList() }
// 房型面板先改草稿，点确定后应用；关闭面板不更改筛选。
const PANEL_FACS = [{ label: '停车', code: 'parking' }, { label: '空调', code: 'ac' }, { label: '可做饭', key: 'cookable' }, { label: '学习室', code: 'study' }, { label: '健身房', code: 'gym' }]
const panelFacSpans = evenSpans(PANEL_FACS.length, 3)
const PANEL_CODES = PANEL_FACS.filter(f => f.code).map(f => f.code)
const panelFacCount = () => filter.facilities.filter(c => PANEL_CODES.includes(c)).length + (filter.cookable ? 1 : 0)
const draft = reactive({ room: '不限', bath: '不限', facilities: [], cookable: false })
function openDraft() {
  Object.assign(draft, { room: filter.room, bath: filter.bath, facilities: filter.facilities.filter(c => PANEL_CODES.includes(c)), cookable: !!filter.cookable })
}
const resetDraft = () => Object.assign(draft, { room: '不限', bath: '不限', facilities: [], cookable: false })
const draftFacOn = (f) => (f.key ? !!draft[f.key] : draft.facilities.includes(f.code))
function toggleDraftFac(f) {
  if (f.key) { draft[f.key] = !draft[f.key]; return }
  const i = draft.facilities.indexOf(f.code)
  if (i >= 0) draft.facilities.splice(i, 1)
  else draft.facilities.push(f.code)
}
function applyDraft() {
  filter.room = draft.room
  filter.bath = draft.bath
  // 「更多筛选」里勾的其它设施（Wi-Fi、洗衣机…）保留，只换面板里这几个
  filter.facilities = filter.facilities.filter(c => !PANEL_CODES.includes(c)).concat(draft.facilities)
  // 「可做饭」在整页筛选里是勾选框（checks → filter 的 watch），两边一起改，下次打开整页筛选也是勾上的
  const c = checks.find(x => x.key === 'cookable')
  if (c) c.on = draft.cookable
  filter.cookable = draft.cookable
  dd.value = ''
  loadList()
}

const listParams = (extra = {}) => {
  const f = filter
  const p = PRICE_RANGE[f.price] || []
  return {
    city: state.city || undefined, keyword: kw.value.trim() || undefined, area: f.area || undefined, district: f.district || undefined,
    operateMode: SRC_MODE[src.value] || undefined,
    priceMinFen: p[0], priceMaxFen: p[1], roomKind: ROOM_KIND[f.room] || undefined, roomSize: ROOM_SIZE[f.room] || undefined, bath: BATH[f.bath] || undefined,
    facilities: f.facilities.length ? f.facilities.join(',') : undefined,
    cookable: f.cookable ? 1 : undefined, kitchen: f.kitchen ? 1 : undefined, longStay: f.longStay ? 1 : undefined,
    scoreMin10: SCORE_MIN[f.score], distMax: DIST_MAX[f.dist], sort: sort.value || undefined,
    checkIn: state.checkIn, checkOut: state.checkOut, guests: state.guests, ...extra
  }
}
const listLoaded = ref(false)
const listLoading = ref(false)
const listError = ref('')
let listSeq = 0
async function loadList(append = false) {
  if (append && (listLoading.value || !hasMore.value)) return
  const seq = ++listSeq, city = state.city
  const next = append ? pageNum.value + 1 : 1
  listLoading.value = true
  listError.value = ''
  if (!append) { rows.value = []; listLoaded.value = false; hasMore.value = false; counts.value = { all: 0, direct: 0, managed: 0 } }
  try {
    const d = (await apiStayList(listParams({ pageNum: next, pageSize: 10 }))).data || {}
    if (seq !== listSeq || city !== state.city) return
    rows.value = append ? rows.value.concat(d.rows || []) : (d.rows || [])
    counts.value = d.counts || counts.value
    hasMore.value = !!d.hasMore
    pageNum.value = next
    listLoaded.value = true
  } catch (e) {
    if (seq !== listSeq || city !== state.city) return
    listError.value = errText(e, '房源加载失败')
  } finally {
    if (seq === listSeq) listLoading.value = false
  }
}
onReachBottom(() => { if (s.value === 2 && hasMore.value) loadList(true) })
const openDetail = (h) => go(R.stayDetail + '?stayId=' + h.stayId)

// ---------------- s=3 早鸟 ----------------
const promo = ref({ rows: [] })
const promoLoaded = ref(false)
const now = ref(Date.now())
let timer = null
let skew = 0
onUnmounted(() => { if (timer) clearInterval(timer) })
async function loadPromos() {
  try {
    promo.value = (await apiStayPromos(state.city)).data || { rows: [] }
    skew = serverTs(promo.value.serverTime) ? serverTs(promo.value.serverTime) - Date.now() : 0
    if (!timer) timer = setInterval(() => { now.value = Date.now() }, 1000)
    promoLoaded.value = true
  } catch (e) {
    toast(errText(e, '早鸟特价加载失败'))
  }
}
const countdown = computed(() => {
  const end = serverTs(promo.value.nearestSaleEnd)
  const left = end ? Math.max(0, Math.floor((end - now.value - skew) / 1000)) : 0
  return { d: pad2(Math.floor(left / 86400)), h: pad2(Math.floor(left % 86400 / 3600)), m: pad2(Math.floor(left % 3600 / 60)), s: pad2(left % 60) }
})
const birds = computed(() => (promo.value.rows || []).map(b => ({
  promoId: b.promoId, stayId: b.stayId, name: `${b.stayName} · ${b.typeName}`, src: srcLabel(b.opType), img: b.cover, where: b.areaDesc,
  old: yuan(b.strikeFen), price: yuan(b.priceFen), left: b.remain, range: `${dayText(b.stayStart)}–${dayText(b.stayEnd)}`,
  refundable: b.refundable, safeCert: b.safeCert
})))
const openPromo = (b) => go(R.stayDetail + '?stayId=' + b.stayId + '&promoId=' + b.promoId)
// 早鸟特价是从房源详情的「早鸟价」点进来的（?view=promo）：之前左上角返回落到全部房源列表，回不到刚才那间房源
const backFromPromo = () => { if (promoEntry) back(); else s.value = 2 }

// ---------------- s=4 筛选 ----------------
// 价格档（2026-10-17）：之前 5 档，一行 3 个第二行空一格；改成 6 档一行 3 个排满两行。
// 2026-10-18 主人效果图是四档一行（不限 / 100-200 / 200-400 / 400以上）：改成四档、四列对齐；第一档写「¥200以下」不写「100-200」——
// 青旅床位、多人间常常一晚几十块，写 100-200 会把它们漏掉。订房入口、列表「价格」下拉、筛选排序页用的是同一组
const priceOpts = ['不限', '¥200以下', '¥200–400', '¥400以上']
// 房型（2026-10-11）：加了单人间 / 双人间（独立房间且可住 1 / 2 人）、女生 / 男生多人间（房型名称或亮点里写了女生 / 男生）；
// 卫浴单独一组（按房型亮点里的「独立卫浴 / 公共卫浴」认，整院算独立卫浴），两组组合 = 「单人间公卫」「男生多人间公卫」这类
const roomOpts = ['不限', '单人间', '双人间', '男生多人间', '女生多人间']
const bathOpts = ['不限', '独立卫浴', '公共卫浴']
const srcOpts = ['不限', '袋鼠直营', '袋鼠合作']
// 推荐评分（2026-10-18 效果图「不限 / 4.5以上 / 4.8以上」）：再留一档 4.0，凑满四列一行
const scoreOpts = ['不限', '4.0分以上', '4.5分以上', '4.8分以上']
const distOpts = ['不限', '1km内', '3km内', '5km内']
const PRICE_RANGE = { '¥200以下': [0, 20000], '¥200–400': [20000, 40000], '¥400以上': [40000, undefined] }
const ROOM_KIND = { 整院: 'whole', 独立房间: 'private', 多人间: 'shared' }
const ROOM_SIZE = { 单人间: 'single', 双人间: 'double', 女生多人间: 'dorm_female', 男生多人间: 'dorm_male' }
const BATH = { 独立卫浴: 'private', 公共卫浴: 'shared' }
const SRC_MODE = { direct: 'direct', agent: 'managed', 袋鼠直营: 'direct', 袋鼠合作: 'managed' }
const SCORE_MIN = { '4.8分以上': 48, '4.5分以上': 45, '4.0分以上': 40 }
const DIST_MAX = { '1km内': 1000, '3km内': 3000, '5km内': 5000 }
// 设施只放房源设施字典（kg_stay_facility）里有的值；「独立卫浴」挪到上面的「卫浴」一组，按房型筛（同一家店有独卫房也有公卫床位时分得清）
// 2026-10-17 R2：字典补了学习室（study）、健身房（gym），这里也能勾。
// 10-19 复查（主人：「要排列好看」）：之前 7 个排成 3 + 2 + 2，后两行的格子比第一行宽；字典里的「热水」（hotwater，员工端能勾）补回来，
// 8 个四列两行，每格一样大
const facilities = [
  { icon: 'wind', label: '空调', code: 'ac' }, { icon: 'wifi', label: 'Wi-Fi', code: 'wifi' }, { icon: 'shirt', label: '洗衣机', code: 'washer' },
  { icon: 'car', label: '停车', code: 'parking' }, { icon: 'square-plus', label: '阳台', code: 'balcony' }, { icon: 'droplet', label: '热水', code: 'hotwater' },
  { icon: 'book-open', label: '学习室', code: 'study' }, { icon: 'activity', label: '健身房', code: 'gym' }
]
const facGridSpans = evenSpans(facilities.length, 4)
// district：所在区县（2026-10-17 R2），和商圈 area 二选一
const filter = reactive({ price: '不限', room: '不限', bath: '不限', source: '不限', score: '不限', dist: '不限', area: '', district: '', facilities: [], cookable: false, longStay: false, kitchen: false })
const checks = reactive([{ label: '可做饭', key: 'cookable', on: false }, { label: '长住优惠', key: 'longStay', on: false }, { label: '带厨房', key: 'kitchen', on: false }])
const price = computed({ get: () => filter.price, set: (v) => { filter.price = v } })
const room = computed({ get: () => filter.room, set: (v) => { filter.room = v } })
const bath = computed({ get: () => filter.bath, set: (v) => { filter.bath = v } })
const source = computed({ get: () => filter.source, set: (v) => { filter.source = v } })
const score = computed({ get: () => filter.score, set: (v) => { filter.score = v } })
const dist = computed({ get: () => filter.dist, set: (v) => { filter.dist = v } })
const mapUrl = ref('') // 没有配置地图服务：不显示地图预览图
const areaFilterText = computed(() => (districtRows.value.length ? '按区县 / 商圈：' : '按商圈：') + (filter.district || filter.area || '不限'))
const facOn = (f) => filter.facilities.includes(f.code)
const toggleFac = (f) => {
  const i = filter.facilities.indexOf(f.code)
  if (i >= 0) filter.facilities.splice(i, 1)
  else filter.facilities.push(f.code)
}
const reset = () => {
  Object.assign(filter, { price: '不限', room: '不限', bath: '不限', source: '不限', score: '不限', dist: '不限', area: '', district: '', facilities: [], cookable: false, longStay: false, kitchen: false })
  checks.forEach(c => { c.on = false })
}
watch(checks, () => { checks.forEach(c => { filter[c.key] = c.on }) }, { deep: true })
const previewTotal = ref(0)
let previewTimer = null
watch(filter, () => {
  if (previewTimer) clearTimeout(previewTimer)
  previewTimer = setTimeout(async () => {
    // 「查看 N 家」按筛选页上选的来源算（应用后页签会切到它），不按当前页签
    try { previewTotal.value = ((await apiStayList(listParams({ pageNum: 1, pageSize: 1, operateMode: SRC_MODE[filter.source] || undefined }))).data || {}).total || 0 } catch (e) { /* 数字刷不出来不影响筛选 */ }
  }, 300)
}, { deep: true, immediate: true })
function applyFilter() {
  const next = filter.source === '袋鼠直营' ? 'direct' : (filter.source === '袋鼠合作' ? 'agent' : 'all')
  s.value = 2
  // 来源页签变了由 watch(src) 负责重新拉，没变就这里拉一次，避免同一组条件请求两遍
  if (src.value !== next) src.value = next
  else loadList()
}

const pageShareMessage = () => publicShare('/pages/stays/list', {city:state.city}, '袋鼠全球青年 · 旅居订房')

onShareAppMessage((event) => shareWithCover(pageShareMessage(event)))
onShareTimeline(() => timelineShare(pageShareMessage()))
onShow(showPublicShareMenu)
watchStayGate(stayBookingEnabled, enabled => { if(enabled) init() })
</script>

<style scoped lang="scss">
@import '../../styles/look.scss';
.stays { --k-bg: #FCF9F3; background: var(--k-bg); color: var(--k-ink); }
.brand { display: flex; align-items: center; gap: 14px; padding-left: 8px; width: 100%; min-width: 0; box-sizing: border-box; }
.brand__name { flex: 0 0 auto; font-family: var(--k-brand); font-weight: 700; font-size: 22px; letter-spacing: .5px; color: var(--k-ink); }
.brand__city { display: flex; align-items: center; gap: 3px; min-width: 0; min-height: 44px; padding-right: 8px; }
.brand__city-text { min-width: 0; font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.entry { padding-top: 18px; }
.sbox { padding: 20px 18px 18px; border: 1px solid var(--k-line); border-radius: 16px; background: var(--k-paper); }
.sbox__head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin-bottom: 18px; }
.sbox__title { display: block; font-size: 20px; font-weight: 700; color: var(--k-ink); }
.sbox__tip { font-size: 12px; color: var(--k-muted); }
.booking-label { display: block; margin-bottom: 8px; font-size: 13px; line-height: 1.4; color: var(--k-muted); }
.dpill { padding: 14px; border-radius: 12px; background: var(--k-paper2); display: flex; align-items: center; gap: 6px; }
.dpill__day { flex: 1; min-width: 0; }
.dpill__day--end { text-align: right; }
.sbox__big { display: block; font-size: 22px; font-weight: 700; line-height: 1.3; white-space: nowrap; color: var(--k-ink); }
.sbox__wk { display: block; margin-top: 5px; font-size: 13px; color: var(--k-muted); }
.dpill__middle { flex: 0 0 40px; display: flex; flex-direction: column; align-items: center; gap: 6px; }
.dpill__nights { font-size: 12px; line-height: 1.4; color: var(--k-ink2); white-space: nowrap; }
.sbox__pair { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); margin: 16px 0; }
.cpill { min-width: 0; min-height: 60px; padding: 0 12px 0 0; display: flex; align-items: center; gap: 6px; }
.cpill + .cpill { padding: 0 0 0 16px; border-left: 1px solid var(--k-line); }
.cpill__body { flex: 1; min-width: 0; }
.cpill .booking-label { margin-bottom: 6px; }
.cpill__text { display: block; font-size: 16px; line-height: 1.5; font-weight: 600; color: var(--k-ink); }
.sbox__area { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.sbox__search { min-width: 0; min-height: 48px; padding: 0 12px; gap: 8px; display: flex; align-items: center; background: var(--k-bg); border-radius: 12px; }
.sbox__search input { flex: 1; min-width: 0; height: 48px; font-size: 14px; }
.entry-search { min-height: 50px; margin-top: 14px; padding: 0 18px; border-radius: 12px; display: flex; align-items: center; justify-content: center; gap: 12px; background: var(--k-red-deep); color: var(--k-paper); font-size: 17px; font-weight: 600; }
.recent { margin: 20px 0 4px; }
.recent .k-section__title { font-size: 14px; font-weight: 500; color: var(--k-muted); }
.recent .k-small { min-height: 44px; display: flex; align-items: center; }
.recent-tags { flex-wrap: wrap; gap: 8px; }
.tag { min-height: 36px; padding: 0 12px; border-radius: 8px; background: var(--k-paper2); display: flex; align-items: center; font-size: 13px; color: var(--k-ink2); }
.areas { margin: 28px 0 16px; align-items: center; }
.areas .k-section__title { font-size: 20px; font-weight: 700; }
.areas__subtitle { display: block; margin-top: 6px; font-size: 13px; color: var(--k-muted); }
.areas .k-section__more { min-height: 44px; padding-left: 12px; font-size: 14px; color: var(--k-muted); }
.preview-notice { display: flex; align-items: flex-start; gap: 6px; margin: -6px 0 14px; padding: 9px 11px; border-radius: 8px; background: #F2E9DD; color: #82705B; font-size: 12px; line-height: 1.6; }
.preview-notice > text { flex: 1; min-width: 0; }
.pv__location { display: block; margin-top: 5px; font-size: 12px; color: #8F7355; }
.pv-grid { gap: 12px; }
.pv { min-width: 0; overflow: hidden; border-radius: 16px; background: var(--k-paper); }
.pv__pic { position: relative; }
.pv__img { display: block; width: 100%; height: 132px; background: var(--k-paper2); }
.pv__src { position: absolute; left: 8px; top: 8px; padding: 4px 7px; border-radius: 6px; background: var(--k-paper); color: var(--k-ink2); font-size: 11px; font-weight: 500; line-height: 1.3; }
.pv__body { padding: 12px 10px 14px; }
.pv__name { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; font-size: 16px; font-weight: 600; line-height: 1.4; color: var(--k-ink); }
.pv__meta { margin-top: 7px; display: flex; align-items: center; gap: 3px; min-width: 0; }
.pv__score { font-size: 12px; font-weight: 600; color: var(--k-red-deep); }
.pv__sub { min-width: 0; font-size: 12px; color: var(--k-muted); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.pv__price { margin-top: 10px; align-items: baseline; gap: 2px; }
.pv__num { color: var(--k-red-deep); font-weight: 700; font-size: 22px; line-height: 1; }
.pv-grid--single { grid-template-columns: minmax(0, 1fr); }
.pv-grid--single .pv { display: flex; }
.pv-grid--single .pv__pic { flex: 0 0 44%; min-width: 0; }
.pv-grid--single .pv__img { height: 154px; }
.pv-grid--single .pv__body { flex: 1; min-width: 0; padding: 16px; display: flex; flex-direction: column; justify-content: center; }
.entry-status { min-height: 160px; padding: 24px 16px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; text-align: center; font-size: 15px; color: var(--k-ink2); }
.entry-status__hint { font-size: 13px; color: var(--k-muted); }
.entry-status__action { min-height: 44px; padding: 0 16px; display: flex; align-items: center; color: var(--k-red-deep); text-decoration: underline; }
@media (max-width: 359px) {
  .brand { gap: 8px; }
  .brand__name { font-size: 20px; letter-spacing: 0; }
  .brand__city { padding-right: 4px; }
  .sbox { padding: 18px 14px 14px; }
  .sbox__tip { font-size: 11px; }
  .dpill { padding: 12px 10px; gap: 4px; }
  .sbox__big { font-size: 19px; }
  .dpill__middle { flex-basis: 32px; }
  .pv__img { height: 110px; }
  .pv__name { font-size: 15px; }
}

/* 列表页顶部（效果图 6）：搜索框 + 四个下拉胶囊；展开的那个暖棕实心白字，选了值的棕字；面板盖在列表上方，不把列表往下推 */
.lbar { position: relative; padding: 4px 16px 12px; }
.ltitle { margin-left: 2px; font-family: var(--k-display-font); font-size: 22px; font-weight: 700; color: $look-ink; max-width: calc(100vw - 154px); white-space: nowrap; }
.ltitle--long { font-size: 16px; line-height: 1.2; white-space: normal; }
/* 列表页搜索：白底细描边大胶囊，暖棕「搜索」在胶囊里面右侧 */
.lsearch { flex: 1; min-width: 0; height: 46px; padding: 0 4px 0 14px; display: flex; align-items: center; gap: 8px; background: #fff; border: 1px solid #E8DACA; border-radius: 999px; box-shadow: $look-shadow-sm; }
.lsearch__input { flex: 1; min-width: 0; height: 44px; font-size: 14px; }
.lsearch__btn { flex: 0 0 auto; height: 36px; padding: 0 18px; border-radius: 999px; background: $look-grad-brown; color: #fff; font-size: 15px; font-weight: 700; display: flex; align-items: center; }
.lbar__search { margin-bottom: 12px; }
.filters { display: flex; align-items: center; gap: 8px; }
.filters__item { flex: 1; min-width: 0; height: 36px; padding: 0 6px; border-radius: 999px; background: #fff; border: $look-hairline; box-shadow: $look-shadow-sm; display: flex; align-items: center; justify-content: center; gap: 2px; font-size: 14px; font-weight: 600; color: $look-ink; }
.filters__text { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.filters__item.set { color: $look-chip-on-ink; font-weight: 700; border-color: rgba(201, 147, 95, .55); }
.filters__item.open { background: $look-grad-brown; border-color: transparent; color: #fff; font-weight: 700; }
.dd-mask { position: absolute; left: 0; right: 0; top: 100%; height: 100vh; background: rgba(58, 50, 43, .35); }
.dd { position: absolute; left: 12px; right: 12px; top: calc(100% - 4px); padding: 18px 16px 18px; border-radius: 16px; background: var(--k-paper); box-shadow: 0 8px 24px rgba(58, 50, 43, .10); max-height: calc(100vh - 220px); overflow-y: auto; box-sizing: border-box; } /* 10-19：最高到屏幕底边往上留一点（之前 70vh，矮屏上面板底部的「确定」落到屏幕外） */
.dd__title { display: block; margin-bottom: 12px; font-family: var(--k-display-font); font-weight: 700; font-size: 18px; color: $look-ink; }
.dd__reset { margin-bottom: 12px; padding: 2px 0 2px 12px; font-size: 14px; font-weight: 600; color: $look-chip-on-ink; }
.dd__sub { display: block; margin: 4px 0 10px; font-size: 14px; font-weight: 700; color: $look-ink; }
.dd__sub ~ .dd__sub { margin-top: 14px; }
.dd__sub--gap { margin-top: 14px; } /* 位置面板第二组「商圈」（2026-10-17 R2） */
.dd__line { height: 1px; margin: 16px 0 12px; background: #F0E8DE; }
.dd__empty { display: block; margin-top: 10px; font-size: 12px; color: var(--k-muted); }
.dd__retry { display: block; padding: 8px 0 14px; font-size: 13px; color: var(--k-red-deep); }
.list-loading { display: block; padding: 32px 0; text-align: center; font-size: 14px; color: var(--k-muted); }
.dd__ok { height: 46px; border-radius: 12px; background: var(--k-red); display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 600; font-size: 16px; }
.dd.dd--room { padding: 0; overflow: hidden; }
.room-panel__head { padding: 18px 16px 6px; }
.room-panel__body { height: 390px; max-height: calc(100vh - 364px); }
.room-panel__options { padding: 0 16px 16px; }
.room-panel__footer { padding: 12px 16px 16px; border-top: 1px solid #F0E8DE; background: var(--k-paper); }
.dd--location .grid12 .opt, .location-grid .opt { min-height: 44px; padding: 8px 6px; border-radius: 10px; white-space: normal; word-break: break-all; line-height: 1.4; }
.location-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.dd__row { height: 46px; display: flex; align-items: center; justify-content: space-between; font-size: 15px; border-bottom: 1px solid var(--k-line); }
.dd__row:last-child { border-bottom: 0; }
.dd__row.on { color: $look-chip-on-ink; font-weight: 700; }
/* 12 栏网格：每个选项占几栏由 evenSpans 算（一行 3 个各 4 栏、2 个各 6 栏），每行铺满不留空洞（位置、价格这种个数跟着数据变的组用） */
.grid12 { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 10px 8px; }
.grid12 .opt { min-height: 38px; border-radius: 999px; @include look-chip; font-size: 14px; }
.grid12 .opt.on { @include look-chip-on; }
/* 房型与完整筛选使用相同的八项；设施按三加二排满。 */
.gcols { display: grid; gap: 10px 8px; }
.gcols--3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.gcols--room { grid-template-columns: repeat(6, minmax(0, 1fr)); }
.gcols--room .opt { grid-column: span 2; }
.gcols--room .opt:nth-child(n+4) { grid-column: span 3; }
.gcols--5 { grid-template-columns: repeat(12, minmax(0, 1fr)); }
.gcols .opt { min-width: 0; min-height: 44px; padding: 0 2px; border-radius: 10px; background: #F7F5F1; border-color: transparent; color: var(--k-ink2); font-size: 13px; white-space: nowrap; }
.gcols .opt.on { background: #F4E8D8; border-color: #BB976E; color: var(--k-red-deep); font-weight: 600; }
/* 窄屏房型改两列，让完整名称和点击区域都保持清晰。 */
@media (max-width: 359px) { .gcols { gap: 8px 6px; } .gcols .opt { font-size: 12px; } .gcols--4 { grid-template-columns: repeat(2, minmax(0, 1fr)); } .gcols--4 .opt { font-size: 14px; } .grid12--price .opt { padding: 0 2px; font-size: 12px; white-space: nowrap; } }

/* 2026-10-18：来源三颗胶囊和「更多筛选」排在同一行（之前一换行「更多筛选」孤零零掉到下一行）；放不下时胶囊这一段左右滑 */
.src-row { display: flex; align-items: center; justify-content: space-between; flex-wrap: nowrap; gap: 8px; margin: 2px 0 14px; }
.src-tabs { flex: 1; min-width: 0; flex-wrap: nowrap; overflow-x: auto; gap: 5px; }
.pill { flex: 0 0 auto; white-space: nowrap; height: 32px; padding: 0 10px; border-radius: 999px; @include look-chip; display: flex; align-items: center; gap: 2px; font-size: 13px; }
.pill.on { background: $look-grad-brown; border-color: transparent; color: #fff; font-weight: 700; }
.pill__n { font-size: 10px; opacity: .75; }
.more-filter { flex: 0 0 auto; white-space: nowrap; display: flex; align-items: center; gap: 2px; padding: 4px 0 4px 2px; font-size: 13px; color: var(--k-ink); }
.home { display: flex; gap: 12px; padding: 12px; @include look-card(20px); margin-bottom: 14px; }
.home__pic { position: relative; width: 40%; max-width: 150px; height: 150px; border-radius: 16px; overflow: hidden; flex: 0 0 auto; background: #DDD5C8; } /* 参考图 8：左图约四成宽、接近正方 */
.home__img { width: 100%; height: 100%; }
.badges { position: absolute; left: 6px; top: 6px; display: flex; gap: 4px; }
.badge { height: 20px; padding: 0 7px; border-radius: 5px; display: flex; align-items: center; font-size: 11px; line-height: 1; }
.badge--src { background: rgba(253,251,247,.95); color: var(--k-red); font-weight: 600; }
.badge--safe { background: rgba(231,239,231,.96); color: var(--k-green); }
.home__body { display: flex; flex-direction: column; }
.home__name { font-family: var(--k-display-font); font-weight: 700; font-size: 18px; line-height: 1.3; color: $look-ink; }
.home__fav { flex: 0 0 auto; padding: 2px 0 2px 6px; }
/* 2026-10-18：写成 .chip.chip--x —— 后面的 .chip 通用样式（奶油底灰字）同权重、写在后面，之前把来源 / 安心住的颜色盖掉了 */
.chip.chip--src { background: #F3E6D6; color: $look-chip-on-ink; font-weight: 700; }
.chip.chip--src.chip--co { background: #EFECE8; color: var(--k-ink2); } /* 参考图 8：袋鼠直营浅棕底、袋鼠合作浅灰底 */
.chip.chip--safe { background: $look-green-soft; color: $look-green; font-weight: 700; }
.chip.chip--ok { background: $look-green-soft; color: $look-green; font-weight: 700; }
.chip.chip--off { background: var(--k-paper2); color: var(--k-muted); }
.home__rate { align-items: baseline; }
.home__score { color: $look-brown; font-family: var(--k-display-font); font-weight: 700; font-size: 15px; }
.home__where { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.home__price { align-items: baseline; margin-left: auto; }
.home__tagline { margin-top: 10px; align-self: flex-start; max-width: 100%; height: 24px; padding: 0 10px; border-radius: 999px; background: $look-chip-bg; display: flex; flex-wrap: nowrap; overflow: hidden; }
.home__tag { flex: 0 1 auto; min-width: 0; height: 24px; color: var(--k-ink2); font-size: 11px; line-height: 24px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.home__tag + .home__tag::before { content: '｜'; color: #B9AFA5; } /* 参考图 8：底部一颗浅灰胶囊「已核验｜近古城｜安静」 */
/* 小院名太长时一行省略，收藏心形不被挤走；标签、价格行放不下时换行，不撑出卡片 */
.home__name--one { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.home__tags { flex-wrap: wrap; row-gap: 6px; }
.home__foot { flex-wrap: wrap; row-gap: 2px; }
/* 参考图 8：价格「¥168 起」单独一行靠右大字，「可订 10.17-10.18」绿字在它下面（之前同一行，日期和价格挤在一起） */
.home__foot .home__price { flex-wrap:wrap;row-gap:4px; order: -1; flex: 0 0 100%; justify-content: flex-end; }
/* 余量文字（「超出可住人数」「余量不足」）和日期各自整块换行，320 宽的手机上不再断成「超出可住 / 人数」「10.20– / 10.21」 */
.home__avail { flex-wrap: wrap; row-gap: 2px; }.home__avail>text { white-space: nowrap; }
.recent-tags { flex-wrap: wrap; row-gap: 10px; }
.list-empty { padding: 40px 0 24px; display: flex; flex-direction: column; align-items: center; gap: 6px; font-size: 15px; }
.list-empty__sub { font-size: 13px; color: var(--k-muted); }
.list-empty__btn { margin-top: 10px; height: 36px; padding: 0 18px; border: 1px solid var(--k-line2); border-radius: 8px; background: var(--k-paper); display: flex; align-items: center; font-size: 14px; }
.list-end { display: block; padding: 4px 0 8px; text-align: center; font-size: 12px; color: var(--k-light); }
.chip { height: 22px; padding: 0 8px; border-radius: 6px; background: var(--k-paper2); font-size: 11px; color: var(--k-muted); display: flex; align-items: center; }
.home__meta { display: block; font-size: 13px; color: var(--k-muted); line-height: 1.4; }
.yen { color: $look-brown; font-size: 14px; font-weight: 700; margin-right: 1px; }
.price { color: $look-brown; font-family: var(--k-display-font); font-weight: 900; font-size: 26px; line-height: 1; letter-spacing: -.3px; }
.home__unit { font-size: 13px; color: var(--k-muted); margin-left: 2px; }
.avail { font-size: 13px; font-weight: 700; color: $look-green; }

.bird-head { padding: 2px 4px 12px; }
.bird-head__title { font-family: var(--k-display-font); font-weight: 700; font-size: 16px; }
.tbox { min-width: 22px; height: 22px; padding: 0 3px; border-radius: 4px; background: var(--k-ink); color: #fff; font-size: 13px; font-weight: 600; display: flex; align-items: center; justify-content: center; }
.tsep { font-size: 13px; color: var(--k-ink); }
.bird { display: flex; gap: 14px; padding: 12px; background: var(--k-paper); border: 1px solid var(--k-line); border-radius: 14px; margin-bottom: 12px; }
.bird__pic { position: relative; width: 104px; height: 164px; border-radius: 8px; overflow: hidden; flex: 0 0 auto; background: #DDD5C8; }
.bird__img { width: 100%; height: 100%; }
.bird__price { display: flex; align-items: baseline; justify-content: flex-end; }
.strike { font-size: 13px; color: var(--k-light); text-decoration: line-through; margin-right: 8px; }
.bird__left { display: block; text-align: right; font-size: 13px; color: var(--k-red); }
.bird__line { height: 1px; background: var(--k-line); margin: 10px 0; }
.mark { width: 16px; height: 16px; }

/* 「重置」挪到底栏、主按钮左边（像爱彼迎筛选页的「清除全部 | 显示 N 个结果」）。之前放在顶栏右边：小程序里右侧插槽要给胶囊让位往左推，
   标题又是绝对定位居中，窄屏手机上「筛选排序」会压到「重置」。
   用行高居中、不用 flex：flex 容器里的文字成了独立的块，外层写的下划线画不到它身上 */
.foot-reset { flex: 0 0 auto; height: 44px; line-height: 44px; padding: 0 6px; font-size: 15px; font-weight: 600; text-decoration: underline; }
.foot-main { flex: 1; min-width: 0; }
.filter { padding-top: 8px; }
.fcard { background: var(--k-paper); border: 1px solid var(--k-line); border-radius: 14px; padding: 12px 12px 14px; margin-bottom: 10px; }
.fcard__title { font-family: var(--k-display-font); font-weight: 700; font-size: 16px; }
.fcard__sub { font-family: var(--k-display-font); font-weight: 700; font-size: 15px; width: 58px; flex: 0 0 auto; }
.map { width: 100%; height: 100px; border-radius: 8px; margin-top: 10px; }
.opts { display: grid; gap: 8px; margin-top: 12px; }
.opts.no-mt { margin-top: 0; }
/* 之前价格一行塞 5 个、评分 / 距离前面还占一列标题，选项又不许换行：「¥150–300」「4.5分以上」在 360–390px 宽的手机上挤出边框，
   设施一行 5 个图标 + 文字也放不下。现在价格一行 3 个、评分 / 距离的标题放到上面、设施改成能换行的格子，字太长就在格子里折行 */
.opts--5 { grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; }
.opts--4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
/* 与下拉面板一致：常规四列，窄屏两列。 */
.opts--room { grid-template-columns: repeat(6, minmax(0, 1fr)); }
.opts--room .opt { grid-column: span 2; }
.opts--room .opt:nth-child(n+4) { grid-column: span 3; }
.opts--room .opt { min-height: 44px; font-size: 13px; white-space: nowrap; }
@media (max-width: 359px) { .opts--room .opt { font-size: 14px; } }
.opts--3 { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.opts--tight { margin-top: 8px; gap: 8px 6px; }
.opt { min-height: 32px; box-sizing: border-box; padding: 3px 4px; border: 1px solid var(--k-line2); border-radius: 8px; background: var(--k-paper); display: flex; align-items: center; justify-content: center; text-align: center; font-size: 13px; line-height: 1.25; word-break: keep-all; }
.opts--tight .opt { padding: 3px 2px; font-size: 12px; }
.opt.on { border-color: var(--k-red); color: var(--k-red-deep); background: var(--k-red-soft); font-weight: 600; }
.fcard__sub--top { display: block; width: auto; margin-top: 12px; font-size: 14px; }
/* 设施格子（2026-10-17 R2 补了学习室 / 健身房；10-19 补回热水，8 个）：12 栏 + evenSpans，四列两行，每格一样大 */
.fac-grid { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 8px 6px; margin-top: 8px; }
.fac-chip { min-height: 32px; box-sizing: border-box; padding: 3px 4px; border: 1px solid var(--k-line2); border-radius: 8px; background: var(--k-paper); display: flex; align-items: center; justify-content: center; gap: 4px; }
.fac-chip.on { border-color: var(--k-red); background: var(--k-red-soft); }
.fac-chip__label { min-width: 0; font-size: 13px; line-height: 1.25; color: var(--k-ink); word-break: break-all; }
/* 10-19：设施 8 个四列，320 宽一格约 60px —— 图标和字的间距、内边距收一点，「学习室」不折成两行；
   价格「¥200–400」不在横线处断成两行；下面三个勾选项的字收一号，「长住优惠」不压到「带厨房」的圆圈 */
@media (max-width: 359px) {
  .fac-chip { padding: 3px 2px; gap: 2px; } .fac-chip__label { font-size: 12px; white-space: nowrap; }
  .opts--4 .opt { padding: 3px 1px; font-size: 12px; white-space: nowrap; }
  .fac-row--checks { padding: 6px; } .fac-check { gap: 4px; } .fac-check__label { font-size: 12px; white-space: nowrap; }
}
.fac-chip.on .fac-chip__label { color: var(--k-red); font-weight: 600; }
.fac-row { display: flex; align-items: center; justify-content: space-between; margin-top: 10px; padding: 0 10px; min-height: 36px; border: 1px solid var(--k-line); border-radius: 8px; }
.fac-row--checks { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; padding: 6px 8px; }
.fac-check { min-width: 0; }
.fac-check__label { min-width: 0; font-size: 14px; line-height: 1.3; word-break: keep-all; }
.ck { flex: 0 0 auto; }
.ck { width: 18px; height: 18px; border: 1.5px solid var(--k-line2); background: var(--k-paper); }
.ck.on { border-color: var(--k-green); background: var(--k-green); }
/* 2026-10-22：按参考稿校准首屏密度、行高与图片比例。 */
@import './stays-premium.scss';
.stays { @include stays-surface; }
.stays--entry { background: linear-gradient(155deg,#EAD4BC 0,#F7EADF 260px,#FCF9F5 570px); }
.brand { gap: 16px; }
.brand__name { font-size: 24px; letter-spacing: 1px; }
.brand__city { font-size: 15px; }
.entry { padding-top: 4px; }
.sbox { padding: 16px; border-radius: 15px; border-color: rgba(139,107,75,.22); box-shadow: 0 3px 10px rgba(89,60,36,.09); }
.sbox__head { margin-bottom: 14px; }
.sbox__title { font-size: 21px; letter-spacing: 1px; }
.sbox .booking-label { display: block; width: 100%; margin-bottom: 3px; font-size: 11px; color: #8B7663; }
.dpill { min-height: 70px; padding: 10px 12px; border-radius: 12px; background: #F8EFE4; box-sizing: border-box; }
.dpill__day { display: flex; flex-wrap: wrap; align-items: baseline; gap: 3px; }
.dpill__day--end { justify-content: flex-end; }
.sbox__big { display: inline; font-size: 18px; letter-spacing: -.5px; }
.sbox__wk { display: inline; margin: 0; font-size: 10px; }
.dpill__middle { flex-basis: 31px; gap: 2px; }
.dpill__nights { font-size: 10px; }
.sbox__pair { display: flex; gap: 10px; margin: 10px 0 16px; }
.cpill, .cpill + .cpill { flex: 1; min-height: 58px; min-width: 0; max-width: none; padding: 8px 12px; border: 1px solid #F0E5D8; border-radius: 11px; background: #FFFCF8; box-sizing: border-box; }
.cpill + .cpill { min-width: 110px; }
.cpill__body { min-width: 0; }
.cpill__text { font-size: 17px; line-height: 1.3; }
.sbox__search { min-height: 42px; padding: 0 0 0 10px; border: 1px solid #EEE1D2; background: #FAF2E8; border-radius: 11px; gap: 5px; }
.sbox__search input { height: 42px; font-size: 13px; }
.entry-search { flex: 0 0 52px; min-height: 42px; margin: 0; padding: 0; border-radius: 11px; border-left: 1px solid #EAD9C5; background: #F7E9D8; color: var(--k-red-deep); font-size: 16px; }
.areas { margin: 24px 0 10px; }
.areas .k-section__title { font-size: 21px; letter-spacing: 1px; }
.pv-grid { gap: 10px; }
.pv { border-radius: 12px; box-shadow: 0 3px 10px rgba(65,44,26,.08); }
.pv__pic { height: 0; padding-bottom: 75%; }
.pv__img { position: absolute; inset: 0; height: 100%; }
.pv-grid--single .pv__pic { height: auto; padding-bottom: 0; }
.pv-grid--single .pv__img { height: 100%; min-height: 154px; }
.pv-grid--single .pv { min-height: 154px; }
.pv__src { font-size: 10px; padding: 3px 7px; background: rgba(255,251,244,.94); }
.pv__name { font-size: 16px; font-weight: 700; }
.pv__body { padding: 9px 9px 10px; }
.pv__price { margin-top: 6px; }
.stays--list > view > .k-body { padding: 4px 14px calc(100px + var(--k-safe-bottom)); }
.ltitle { font-size: 23px; }
.lbar { padding: 4px 14px 8px; }
.lbar__search { margin-bottom: 14px; }
.lsearch { height: 40px; border: 1px solid #BDA182; box-shadow: none; }
.lsearch__btn { height: 34px; min-width: 58px; }
.filters { gap: 22px; }
.filters__item { min-height: 34px; height: 34px; background: #F3E8DB; border: 0; box-shadow: none; font-size: 15px; }
.src-row { margin: 4px 0 10px; gap: 6px; }
.pill { font-size: 14px; height: 32px; padding: 0 12px; background: #F0EDEA; }
.pill__n { display: none; }
.more-filter { font-size: 10px; gap: 2px; }
.home { padding: 12px; gap: 12px; border-radius: 14px; border: 1px solid #D8CCBE; background: rgba(255,255,255,.94); box-shadow: 0 2px 5px rgba(92,63,36,.035); margin-bottom: 10px; }
.home__pic { width: 38%; height: 170px; border-radius: 9px; }
.home__name { font-size: 19px; line-height: 1.3; }
.home__fav { padding: 0; min-width: 24px; min-height: 24px; display: flex; align-items: center; justify-content: center; }
.home__tags { margin-top: 6px; gap: 4px; }
.home__tags .chip { height: 20px; padding: 0 5px; font-size: 11px; border-radius: 5px; }
.home__rate { margin-top: 9px; }
.home__score { font-size: 17px; }
.home__meta { font-size: 12px; }
.home__where { margin-top: 3px; font-size: 11px; color: #8C8175; }
.home__foot { margin-top: auto; padding-top: 5px; }
.home__avail { margin-top: 2px; }
.home__avail>text { font-size: 11px; }
.home__price .price { font-size: 27px; }
.home__tagline { margin-top: 6px; height: auto; padding: 2px 6px; border-radius: 6px; }
.home__tag { height: auto; font-size: 10px; line-height: 1.4; }
.dd { left: 0; right: 0; border-radius: 14px; padding: 14px 12px 12px; box-shadow: 0 6px 20px rgba(70,48,30,.16); }
.dd__title { font-size: 20px; }
.dd__sub { font-size: 16px; }
.dd__line { margin: 16px 0; }
.gcols { gap: 8px; }
.gcols .opt { border-radius: 999px; min-height: 44px; background: #F3F2F1; font-size: 13px; }
.gcols .opt.on { background: linear-gradient(110deg,#F8EAD9,#F3DFC4); border-color: #E6CBA7; }
.dd__ok { border-radius: 999px; height: 42px; font-size: 18px; background: linear-gradient(110deg,#B88748,#95612F); }
@media (max-width:359px) {
 .brand__name { font-size: 20px; letter-spacing: 0; } .brand { gap: 8px; }
 .sbox { padding: 14px 12px; } .sbox__big { font-size: 16px; } .sbox__wk { font-size: 9px; }
 .dpill { padding: 5px 8px; } .sbox__pair { gap: 12px; } .cpill,.cpill + .cpill { min-width: 80px; padding: 0 10px; }
 .sbox__search input { font-size: 11px; } .entry-search { flex-basis: 46px; font-size: 15px; }
 .filters { gap: 13px; } .home { gap: 9px; padding: 10px; } .home__pic { width: 37%; height: 165px; }
 .home__name { font-size: 16px; } .home__tags .chip { font-size: 9px; padding: 0 4px; } .home__rate { gap: 2px; } .home__meta { font-size: 10px; }
 .home__score { font-size: 15px; } .pill { font-size: 12px; padding: 0 10px; } .more-filter { font-size: 9px; }
 .pv__img { height: 100%; } .pv__name { font-size: 14px; } .gcols .opt { font-size: 13px; }
}


.stay-period-options, .type-main > .stay-period-options { display: block; margin: 4px 0 0; color: var(--k-muted); font-size: 12px; line-height: 1.55; white-space: pre-line; text-align: left; overflow-wrap: anywhere; }
</style>
