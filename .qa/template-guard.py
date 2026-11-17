# -*- coding: utf-8 -*-
"""页面保护边界检查。

把工作区的每个 .vue 页面与**固定的基线提交**对比，分两档验证。

## 硬边界（任何情况下都不允许，没有豁免通道）

  1. <style> 块完全没变
  2. <template> 的标签开闭序列（结构骨架）没变
  3. <template> 的静态 class 集合没变

这三样是"设计稿长什么样"的骨架。接线不需要动它们，所以它们没有登记机制 ——
一旦不同就是越界，`--approve` 也不会把它们写进基线。

## 软边界（允许改，但必须事先登记在 .qa/approved-diff.json 里）

  4. 文案：<template> 里的文本节点（含 {{ }} 插值），把静态文案换成插值也算
  5. 内联 style：`style="…"` 与 `:style="…"`
  6. 动态 class：`:class="…"` / `v-bind:class="…"`
  7. 指令：`v-if` / `v-else-if` / `v-else` / `v-show` / `v-for` 的**存在与取值**
  8. 同名兄弟节点顺序：节点指纹（深度 + 标签名 + 静态 class）序列里
     "同一批节点原封不动换了位置"的片段

     第 8 条能抓到的前提是被换位的兄弟之间**至少有一处不同**：静态 class 不同、
     子树形状不同、或者带的文本不同（文本由第 4 条抓）。两个除了 `name`、`src`
     这类属性之外完全一样的叶子节点互换，本脚本看不出来 —— 属性值不在检查范围内。

这五样接线时确有正当改动（文案与真实行为对齐见 INTEGRATION.md 9.4；
按状态点亮步骤条必须用 :class；按真实数据决定某块是否出现必须用 v-if），
全等比较会淹没在误报里，没人会看。
所以改成**显式登记**：每一处改动以"旧 → 新"的形式写进 .qa/approved-diff.json，
交给项目主人逐条复核；之后只要差异还是那几处就算通过，
多出任何一处没登记的，立刻判失败并把内容打出来。

## 第 7 条（指令）为什么必须有

Vue 里让一个节点从页面上消失的标准写法不是删标签，是给它加一个 `v-if`。
只看标签序列 / class / 文案 / style 的话，加 `v-if`、把 `v-for` 换个数据源
这类"页面上肉眼可见少了一块 / 多了一块"的改动一个都抓不到 ——
七个维度全绿，报告写着"与基线一致"，而页面已经不是设计稿的样子了。
指令属于软边界不是硬边界：按真实状态显示/隐藏是接线的正当工作，
它需要的是"被人看见并登记"，不是"一律禁止"。

## 注释为什么必须先剥掉，而且是所有维度一起剥

`<!-- … -->` 在渲染时不存在。这带来两个方向的要求，必须同时满足：

  - 注释掉一个节点 == 把它从页面上删掉，所以**必须**表现为标签序列变短 →
    硬边界失败。曾经 tag_sequence() 在原文上数标签，注释掉的节点照样算进去，
    于是"注释掉整段结构"完全无声通过。
  - 反过来，注释里随手写了标签名（`<!-- 这里原来是 <view> -->`）渲染结果没有任何变化，
    就**不能**报成结构变化。硬边界没有豁免通道，`--approve` 也清不掉这种误报，
    报错信息还是假的 —— 这种检查只会逼着后面的人把它整个关掉。

所以模板只在 compare() 里剥一次注释，剥完的文本喂给全部维度，前后一致。

## 基线为什么钉死在一个提交上

早先这里用 `git diff --name-only` 取"被修改的文件"，再跟 HEAD 比。
那样有个致命问题：改动一旦 `git add` 或 `git commit`，清单就变空，
脚本打印"没有被修改的 .vue 文件"并返回 0 —— 检查了零个文件却显示通过。
接线工作一旦入库，页面保护就自动失效了。

现在改成：基线提交号写在 `.qa/baseline-ref` 里，
并且**遍历基线里存在的全部 .vue**，而不是遍历"有改动的文件"。
这样无论改动处于工作区、暂存区还是已提交，检查的对象都不变。

## 两个基线文件为什么只有 --approve 能生成

`baseline-ref` 和 `approved-diff.json` 是这个检查的全部依据。
只要普通运行还肯在文件缺失时**自己把当前工作区写成基线**，检查就是假的：

    python .qa/template-guard.py      # 报警，退出 1
    rm .qa/approved-diff.json
    python .qa/template-guard.py      # "首次生成"，退出 3，但已经写盘了
    python .qa/template-guard.py      # 读到自己刚写的文件，全部命中，退出 0

同一条命令跑三遍，一条改动都没人看过就绿了。所以现在：
**缺文件时只报错、不写盘**，写盘动作唯一化到人工的 `--approve`。
删掉基线文件的人会得到一条"跑 --approve 重建"的提示，而这条命令会在 git 里
留下一个所有人都看得见的、内容是"78 条改动"的 diff —— 这正是要被 review 的东西。

配套地 `.gitignore` 里对 `.qa/` 开了两个例外，让这两个文件进版本库；
否则任何 clone / CI / 同伴的工作副本都没有它们，必然走到"缺文件"这条路径。

## 这个检查挡得住什么、挡不住什么

挡得住：增删 DOM 节点、注释掉 DOM 节点、改 scoped 样式、增删静态 class（硬失败）；
        改文案、加内联 style、加 :class、加 v-if/v-show、换 v-for 数据源、
        同名兄弟节点重排（未登记则失败）。

挡不住（如实列出，别拿这份报告当"像素没动"的证明）：
  - 除 class / style / 上述五个指令之外的属性值，例如 `src` 换图、`:size` 改数字、
    `color` 换色、`mode="aspectFill"` 改成别的填充方式；
  - `<script>` 里改常量间接导致的视觉变化（模板没变，渲染结果变了），
    包括 v-if 表达式不变但它读的那个变量的计算方式变了；
  - styles/*.scss、uni.scss 等全局样式文件（它们不是 .vue，不在本脚本范围内）；
  - 组件实现的改动传导到页面上的效果（components/*.vue 本身在检查范围内，
    但"页面给组件传了不同的 props"不算）；
  - 真正的渲染结果。像素级结论以截图比对（.qa/diff.py）与人工核对为准。

## 硬边界的唯一例外：项目主人明确授权的结构改动（2026-09-18 起）

硬边界原先"没有豁免通道"。2026-09-18 项目主人决定把 39 个原型页开发成三端联调可用的版本、
并给员工端加确认录用 / 标记入职 / 终止 —— 有少数地方必须动结构（例如静态文字要变成输入框、
仿冒的微信界面要换成真实的微信能力）。为此加了一条**逐文件、按精确快照**的登记通道：

  - 登记写在 .qa/approved-structure.json，每个文件一条：当时的样式块、标签序列、静态 class 集合
    三者的指纹，加上必须填写的理由与决定依据；
  - 只有 `--approve-structure <文件> --reason "…"` 能写这条记录（一次一个文件，理由不能为空，
    文件必须真的有硬边界差异）；
  - 检查时只有"当前文件的三份指纹与登记的完全相同"才放行；登记之后再多改一个标签、
    一个 class、一行样式，指纹就对不上，照样判越界；
  - 删除基线里的页面不在例外之内，永远是越界。

能用软边界（换文案、换事件、v-if 切换已有块）做到的，一律不走这条通道。

用法:
    python .qa/template-guard.py                 # 检查基线里的全部 .vue
    python .qa/template-guard.py a.vue b.vue     # 只检查指定文件
    python .qa/template-guard.py --approve       # 人工复核后，把当前软边界差异登记进基线
    python .qa/template-guard.py --approve-structure pages/x.vue --reason "为什么必须改结构"
                                                 # 登记一个文件的结构改动（项目主人授权后）
退出码 0 表示没有越界，1 表示有越界，2 表示基线本身或参数有问题，
3 表示基线文件缺失（本次**没有**生成，需要人工跑 --approve 重建）。
"""
import io
import json
import os
import re
import subprocess
import sys
import time
from collections import Counter
from difflib import SequenceMatcher

QA_DIR = os.path.dirname(os.path.abspath(__file__))
BASELINE_FILE = os.path.join(QA_DIR, 'baseline-ref')
APPROVED_FILE = os.path.join(QA_DIR, 'approved-diff.json')
APPROVED_REL = '.qa/approved-diff.json'
STRUCTURE_FILE = os.path.join(QA_DIR, 'approved-structure.json')
STRUCTURE_REL = '.qa/approved-structure.json'
STRUCTURE_DECISION = ('2026-09-18 项目主人决定：39 个原型页开发成三端联调可用的版本；'
                      '员工端加确认录用 / 标记入职 / 终止')
BASELINE_REL = '.qa/baseline-ref'

# 软边界的五个维度。顺序即报告里的展示顺序。
DIMENSIONS = ['文案', '内联style', '动态class', '指令', '节点顺序']

# 纳入检查的模板指令。它们决定"这个节点这次到底出不出现 / 出现几次"，
# 不跟着它们走的话，加一个 v-if 就能让整块内容从页面上消失而七个维度全绿。
DIRECTIVES = ['v-if', 'v-else-if', 'v-else', 'v-show', 'v-for']
# v-else-if 必须排在 v-else 前面，否则 v-else 会先把 "v-else-if" 的前缀吃掉
DIRECTIVE_NAMES = sorted(DIRECTIVES, key=len, reverse=True)

# HTML 里天生不闭合的标签，算自闭合，否则深度会一路往下错
VOID_TAGS = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
             'link', 'meta', 'param', 'source', 'track', 'wbr'}

COMMENT_RE = re.compile(r'<!--.*?-->', re.S)
# 属性段里先吃掉引号包起来的部分，这样 @click="a > b" 里的 > 不会被当成标签结束
TAG_RE = re.compile(r'<(/?)([A-Za-z][\w.:-]*)((?:"[^"]*"|\'[^\']*\'|[^>"\'])*)>', re.S)
# 属性切词：名字里不许出现空白/=/斜杠/引号/尖括号，值可以是双引号、单引号或裸串，也可以没有。
# 整段一次吃掉（含引号），finditer 的扫描位置才不会落进值里面去，
# 把 :title="选 v-if 还是 v-show" 这种文案当成一个指令。
ATTR_RE = re.compile(r'([^\s=/>"\']+)(?:\s*=\s*(?:"([^"]*)"|\'([^\']*)\'|([^\s"\'>]+)))?')


def git(args):
    return subprocess.run(['git'] + args, capture_output=True, encoding='utf-8', errors='replace')


def baseline_ref(approve):
    """读取钉死的基线提交号。

    文件不在时只有 `--approve` 会重建它。普通运行自己把当前 HEAD 的根提交写成基线，
    等于"检查对象由被检查方现场指定"，和 approved-diff.json 自生成是同一个洞。
    """
    if os.path.exists(BASELINE_FILE):
        ref = io.open(BASELINE_FILE, encoding='utf-8').read().strip().split('#')[0].strip()
        if ref:
            r = git(['rev-parse', '--verify', ref + '^{commit}'])
            if r.returncode != 0:
                print('[基线无效] %s 里的 %s 在本仓库中不存在' % (BASELINE_REL, ref))
                raise SystemExit(2)
            return ref
    if not approve:
        print('[基线缺失] %s 不存在，本次**没有**生成它。' % BASELINE_REL)
        print('           这个文件记的是"接线开始之前的那个提交"，是全部比对的依据；')
        print('           让普通运行顺手补一个出来，就等于让被检查的工作区自己指定基线。')
        print('           确认要（重新）建立基线时，人工跑: python .qa/template-guard.py --approve')
        raise SystemExit(2)
    r = git(['rev-list', '--max-parents=0', 'HEAD'])
    roots = r.stdout.split()
    if not roots:
        print('[基线缺失] 拿不到根提交，无法建立页面基线')
        raise SystemExit(2)
    ref = roots[-1]
    io.open(BASELINE_FILE, 'w', encoding='utf-8', newline='').write(
        ref + '  # 页面保护基线：接线工作开始之前的提交，不要随接线进度更新\n')
    print('[基线已记录] %s -> %s' % (ref, BASELINE_REL))
    return ref


def baseline_vue_files(ref):
    r = git(['ls-tree', '-r', '--name-only', ref])
    return sorted(f for f in r.stdout.splitlines()
                  if f.endswith('.vue') and not f.startswith('dist/'))


def git_show(ref, path):
    r = git(['show', '%s:%s' % (ref, path)])
    return r.stdout.replace('\r\n', '\n') if r.returncode == 0 else None


def section(text, tag):
    m = re.search(r'<%s[^>]*>(.*)</%s>' % (tag, tag), text, re.S)
    return m.group(1) if m else ''


def strip_comments(tpl):
    """注释在渲染时不存在，所以全部维度都必须先把它剥掉再比，一次剥完往下传。"""
    return COMMENT_RE.sub('', tpl)


def tag_sequence(tpl):
    """标签开闭序列，忽略属性。结构变了这个序列就会变。

    用的是和其它维度同一个 TAG_RE：要求有配对的 `>`、属性里的引号先吃掉。
    另起一套宽松正则的话，`{{ a < b }}` 这类文本会在这里多数出一个标签来。
    """
    return [(m.group(1), m.group(2)) for m in TAG_RE.finditer(tpl)]


def iter_attrs(attrs):
    """把属性段切成 (名字, 值) —— 值为 None 表示这个属性是光杆的（v-else）。"""
    for m in ATTR_RE.finditer(attrs):
        val = m.group(2)
        if val is None:
            val = m.group(3)
        if val is None:
            val = m.group(4)
        yield m.group(1), val


def attr_values(attrs, name_pattern):
    """从属性段里取出某个属性的值，单双引号都认。返回 [(属性名, 值)]。"""
    pat = re.compile(r'(?:^|\s)(%s)\s*=\s*(?:"([^"]*)"|\'([^\']*)\')' % name_pattern)
    out = []
    for m in pat.finditer(attrs):
        out.append((m.group(1), m.group(2) if m.group(2) is not None else m.group(3)))
    return out


def directives(attrs):
    """取出这个节点上的显示/循环指令，返回 [(名字, 值或 None)]，保持书写顺序。"""
    out = []
    for name, val in iter_attrs(attrs):
        for d in DIRECTIVE_NAMES:
            # 只认精确同名：v-if-not-really 不是指令，:class 里的 'v-show' 也不是
            if name == d:
                out.append((name, val))
                break
    return out


def static_classes(attrs):
    names = []
    for _, val in attr_values(attrs, r'class'):
        for c in val.split():
            if '{' not in c:
                names.append(c)
    return names


def class_set(tpl):
    """静态 class 的集合。样式类被增删就会变。"""
    out = set()
    for m in TAG_RE.finditer(tpl):
        if m.group(1):
            continue
        out.update(static_classes(m.group(3)))
    return out


def norm_text(raw):
    """只折叠 ASCII 空白。全角空格 U+3000 在设计稿里是排版手段，动了要能看见。"""
    return re.sub(r'[ \t\r\n]+', ' ', raw).strip()


def parse_template(tpl):
    """一遍扫完模板，产出四个可比较的有序序列。

    不是真正的 HTML 解析器，够用就行：标签用正则切，深度用一个栈维护。
    传进来的 tpl 必须已经剥过注释（见 compare）。
    """
    texts, styles, dyn_classes, dirs, fingerprints = [], [], [], [], []
    stack = []
    pos = 0
    for m in TAG_RE.finditer(tpl):
        chunk = norm_text(tpl[pos:m.start()])
        pos = m.end()
        if chunk:
            texts.append(chunk)
        closing, tag, attrs = m.group(1), m.group(2), m.group(3)
        if closing:
            if tag in stack:
                while stack and stack.pop() != tag:
                    pass
            continue
        label = tag + ''.join('.' + c for c in static_classes(attrs))
        # 指纹带上深度，否则同名节点换层也看不出来
        fingerprints.append('%d %s' % (len(stack), label))
        for name, val in attr_values(attrs, r'(?::|v-bind:)?style'):
            styles.append('%s  %s="%s"' % (label, name, norm_text(val)))
        for name, val in attr_values(attrs, r'(?::|v-bind:)class'):
            dyn_classes.append('%s  %s="%s"' % (label, name, norm_text(val)))
        for name, val in directives(attrs):
            # v-else 没有值，记成光杆；写成 v-else="" 会和"删掉 v-else"看起来一样
            dirs.append('%s  %s' % (label, name) if val is None
                        else '%s  %s="%s"' % (label, name, norm_text(val)))
        if not (attrs.rstrip().endswith('/') or tag.lower() in VOID_TAGS):
            stack.append(tag)
    tail = norm_text(tpl[pos:])
    if tail:
        texts.append(tail)
    return {'文案': texts, '内联style': styles, '动态class': dyn_classes,
            '指令': dirs, '节点顺序': fingerprints}


def diff_records(old_items, new_items):
    """把两串条目的差异切成可逐条审查的记录：每条记录就是一段"旧 → 新"。"""
    recs = []
    sm = SequenceMatcher(None, old_items, new_items, autojunk=False)
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op == 'equal':
            continue
        recs.append({'旧': old_items[i1:i2], '新': new_items[j1:j2]})
    return recs


def cap(items, keep=40):
    """记录进基线的片段要能读完。太长就掐中间，掐法固定，同样的输入永远得到同一条记录。"""
    if len(items) <= keep:
        return items
    half = keep // 2
    return items[:half] + ['…（中间省略 %d 项）' % (len(items) - keep)] + items[-half:]


def order_records(old_fp, new_fp):
    """只认"同一批节点换了顺序"。

    节点被纯增删或改了 class，标签结构 / 静态 class 两个硬维度已经在报了，
    在这里再报一遍只会让基线里堆满重复条目，复核的人反而看不见真正的重排。
    判据是"有指纹既出现在删除侧又出现在新增侧" —— 兄弟节点互换在 difflib 眼里
    是一处 insert 加一处 delete（中间还隔着 equal），不是一处 replace，
    只看 replace 会漏掉最典型的重排。
    """
    if old_fp == new_fp:
        return []
    added, removed = [], []
    span = None
    for op, i1, i2, j1, j2 in SequenceMatcher(None, old_fp, new_fp, autojunk=False).get_opcodes():
        if op == 'equal':
            continue
        removed.extend(old_fp[i1:i2])
        added.extend(new_fp[j1:j2])
        span = (min(span[0], i1), max(span[1], i2), min(span[2], j1), max(span[3], j2)) \
            if span else (i1, i2, j1, j2)
    if not (Counter(added) & Counter(removed)):
        return []                          # 没有"同一个节点换了位置"，不属于本维度
    i1, i2, j1, j2 = span
    return [{'旧': cap(old_fp[i1:i2]), '新': cap(new_fp[j1:j2])}]


def rec_key(rec):
    """记录的身份。内容一模一样才算同一条，位置挪了不影响。"""
    return json.dumps([rec['旧'], rec['新']], ensure_ascii=False)


def compare(old, new):
    """返回 (硬边界问题列表, {维度: [记录]})。"""
    hard = []
    # 样式块按原文比，连注释一起。注释掉一条 CSS 规则就是改样式，不能被"剥注释"抹平
    if section(old, 'style') != section(new, 'style'):
        hard.append('样式块被修改')

    # 模板只剥这一次注释，三个模板维度共用，前后口径一致
    told = strip_comments(section(old, 'template'))
    tnew = strip_comments(section(new, 'template'))

    to, tn = tag_sequence(told), tag_sequence(tnew)
    if to != tn:
        hard.append('标签结构变化 (%d -> %d 个标签)' % (len(to), len(tn)))

    co, cn = class_set(told), class_set(tnew)
    if co != cn:
        hard.append('class 变化 +%s -%s' % (sorted(cn - co), sorted(co - cn)))

    po, pn = parse_template(told), parse_template(tnew)
    soft = {}
    for dim in DIMENSIONS:
        if dim == '节点顺序':
            recs = order_records(po[dim], pn[dim])
        else:
            recs = diff_records(po[dim], pn[dim])
        if recs:
            soft[dim] = recs
    return hard, soft


def structure_fingerprint(text):
    """硬边界三要素的指纹：样式块原文、标签开闭序列、静态 class 集合。"""
    import hashlib
    tpl = strip_comments(section(text, 'template'))
    h = lambda v: hashlib.sha256(v.encode('utf-8')).hexdigest()[:16]
    return {
        'style': h(section(text, 'style')),
        'tags': h(json.dumps(tag_sequence(tpl), ensure_ascii=False)),
        'classes': h(json.dumps(sorted(class_set(tpl)), ensure_ascii=False)),
    }


def load_structure():
    if not os.path.exists(STRUCTURE_FILE):
        return {}
    try:
        data = json.loads(io.open(STRUCTURE_FILE, encoding='utf-8').read())
    except ValueError as e:
        print('[登记损坏] %s 不是合法 JSON：%s' % (STRUCTURE_REL, e))
        raise SystemExit(2)
    return data.get('文件') or {}


def write_structure(ref, entries):
    data = {
        '_说明': [
            '用户授权的**结构**改动登记（硬边界的唯一例外），由 --approve-structure 逐文件写入。',
            '每条记的是登记那一刻该文件样式块 / 标签序列 / 静态 class 的指纹：之后再改动任何一处，',
            '指纹对不上，检查照样判越界。删除基线里的页面永远不在例外之内。',
            '每条都必须写清理由；能用软边界做到的改动不应出现在这里。',
        ],
        '基线提交': ref,
        '决定依据': STRUCTURE_DECISION,
        '文件': {k: entries[k] for k in sorted(entries)},
    }
    io.open(STRUCTURE_FILE, 'w', encoding='utf-8', newline='\n').write(
        json.dumps(data, ensure_ascii=False, indent=2) + '\n')


def load_approved():
    """返回 {文件: {维度: {记录 key: 记录}}}；文件不存在时返回 None。"""
    if not os.path.exists(APPROVED_FILE):
        return None
    try:
        data = json.loads(io.open(APPROVED_FILE, encoding='utf-8').read())
    except ValueError as e:
        print('[基线损坏] %s 不是合法 JSON：%s' % (APPROVED_REL, e))
        raise SystemExit(2)
    out = {}
    for path, dims in (data.get('文件') or {}).items():
        out[path] = {}
        for dim, recs in dims.items():
            out[path][dim] = {rec_key(r): r for r in recs}
    return out


def write_approved(ref, per_file):
    total = sum(len(recs) for dims in per_file.values() for recs in dims.values())
    data = {
        '_说明': [
            '页面保护的"已登记改动"清单，由 python .qa/template-guard.py --approve 生成。',
            '这里每一条都是接线过程中对设计稿做的软边界改动，需要项目主人逐条复核。',
            '"旧"是基线提交里的样子，"新"是当前工作区的样子；只列不同的片段，相同的不写。',
            '删掉某一条，下次运行就会把它重新报成越界；因此不要为了让脚本通过而随手添加条目。',
            '"指令"维度记的是 v-if/v-else-if/v-else/v-show/v-for —— 它们决定某块内容出不出现，',
            '复核时要按"页面上该不该有这块"来看，不是按"代码写得对不对"来看。',
            '样式块 / 标签结构 / 静态 class 属于硬边界，永远不会出现在这个文件里。',
            '本文件必须随代码一起提交：它就是交给 code review 的那份改动清单。',
        ],
        '基线提交': ref,
        '生成时间': time.strftime('%Y-%m-%d %H:%M:%S'),
        '生成命令': 'python .qa/template-guard.py --approve',
        '条目总数': total,
        '文件': {path: {dim: per_file[path][dim] for dim in DIMENSIONS if dim in per_file[path]}
                 for path in sorted(per_file)},
    }
    io.open(APPROVED_FILE, 'w', encoding='utf-8', newline='\n').write(
        json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    return total


def brief(items, width=110):
    s = ' ⏎ '.join(items) if items else '（空）'
    return s if len(s) <= width else s[:width] + '…'


def show_record(dim, rec, mark):
    print('      %s [%s]' % (mark, dim))
    print('        旧: %s' % brief(rec['旧']))
    print('        新: %s' % brief(rec['新']))


def main():
    argv = sys.argv[1:]
    if '--help' in argv or '-h' in argv:
        print(__doc__)
        return 0
    if '--approve-structure' in argv:
        return approve_structure(argv)
    approve = '--approve' in argv
    files = [a for a in argv if not a.startswith('-')]
    unknown_flags = [a for a in argv if a.startswith('-') and a != '--approve']
    if unknown_flags:
        print('[参数错误] 不认识的参数: %s（可用 --approve / --approve-structure / --help）'
              % ' '.join(unknown_flags))
        return 2
    if approve and files:
        # 只登记部分文件会把其余文件的已登记条目冲掉，等于悄悄放宽检查
        print('[参数错误] --approve 必须对全部文件生成，不能只登记指定文件')
        return 2

    ref = baseline_ref(approve)
    scope = '指定文件'
    if not files:
        files = baseline_vue_files(ref)
        scope = '基线中的全部 .vue'
    if not files:
        # 基线里一个 .vue 都没有，说明基线选错了，这不是"通过"
        print('[异常] 基线 %s 中没有任何 .vue 文件，检查无意义' % ref[:12])
        return 2

    structure = load_structure()
    structure_ok = 0
    approved = load_approved()
    registry_missing = approved is None
    if approved is None:
        approved = {}

    print('基线提交: %s    检查范围: %s（%d 个文件）' % (ref[:12], scope, len(files)))
    print('登记文件: %s%s\n' % (APPROVED_REL, '' if os.path.exists(APPROVED_FILE) else '（尚不存在）'))

    hard_violations = 0
    missing = 0
    changed = 0
    known = 0
    unknown = 0
    stale = 0
    all_soft = {}

    for f in files:
        old = git_show(ref, f)
        if old is None:
            print('%-40s 基线中不存在（新增文件，跳过）' % f)
            continue
        if not os.path.exists(f):
            missing += 1
            hard_violations += 1
            print('%-40s VIOLATION: 基线里有这个页面，工作区却删掉了' % f)
            continue
        new = io.open(f, encoding='utf-8').read().replace('\r\n', '\n')
        if old == new:
            continue                      # 未改动的页面不刷屏
        changed += 1

        hard, soft = compare(old, new)
        if soft:
            all_soft[f] = soft

        registry = approved.get(f, {})
        file_known, file_unknown = 0, []
        seen_keys = {}
        for dim in DIMENSIONS:
            seen_keys[dim] = set()
            for rec in soft.get(dim, []):
                key = rec_key(rec)
                seen_keys[dim].add(key)
                if key in registry.get(dim, {}):
                    file_known += 1
                else:
                    file_unknown.append((dim, rec))
        for dim, recs in registry.items():
            for key in recs:
                if key not in seen_keys.get(dim, set()):
                    stale += 1
        known += file_known
        unknown += len(file_unknown)

        registered_structure = False
        if hard and f in structure:
            reg = structure[f]
            if reg.get('指纹') == structure_fingerprint(new):
                structure_ok += 1
                registered_structure = True
                print('%-40s OK  已登记的结构改动（%s）' % (f, reg.get('理由', '')[:60]))
                hard = []
            else:
                hard = hard + ['结构改动登记之后又被改过（指纹对不上 %s）' % STRUCTURE_REL]
        if hard:
            hard_violations += 1
            print('%-40s VIOLATION: %s' % (f, '; '.join(hard)))
        if file_unknown and not approve:
            print('%-40s VIOLATION: %d 处未登记的改动' % (f, len(file_unknown)))
            for dim, rec in file_unknown:
                show_record(dim, rec, '✗')
        elif not hard and not registered_structure:
            note = '已登记改动 %d 处' % file_known if file_known else '结构/样式/class/文案/指令与基线一致'
            print('%-40s OK  %s' % (f, note))

    if approve:
        total = write_approved(ref, all_soft)
        print('\n[已登记] %d 处软边界改动写入 %s，请逐条复核' % (total, APPROVED_REL))

    print('\n比对文件数: %d    有改动的: %d' % (len(files), changed))
    print('已记录在案的改动: %d 处    未登记的改动: %d 处    硬边界越界文件数: %d'
          % (known, unknown, hard_violations))
    print('已登记的结构改动文件数: %d（见 %s）' % (structure_ok, STRUCTURE_REL))
    if missing:
        print('其中被删除的页面: %d' % missing)
    if stale:
        # 不算失败：改动被撤回是好事，只是基线该瘦身了
        print('提示: 基线里有 %d 条记录在工作区已经找不到了，可在复核后跑 --approve 清掉' % stale)

    if registry_missing and not approve:
        # 关键：这里**不写盘**。自己生成、自己对照、自己通过等于没有检查，
        # 而且只要肯自动生成，"删掉基线文件再跑一遍"就是洗白任何改动的最省事办法。
        print('\n[登记文件缺失] %s 不存在，本次**没有**生成它。' % APPROVED_REL)
        print('               上面列出的每一处都还没有人看过。逐条复核确认正当之后，跑:')
        print('                   python .qa/template-guard.py --approve')
        print('               并把 %s 的变化一并提交，供复核。' % APPROVED_REL)
        return 3

    if unknown and not approve:
        print('\n出现了没有登记的改动。确认这些改动正当后，跑:')
        print('    python .qa/template-guard.py --approve')
        print('并把 %s 的变化一并提交，供复核。' % APPROVED_REL)
    return 1 if (hard_violations or (unknown and not approve)) else 0


def approve_structure(argv):
    """--approve-structure <文件> --reason "…"：给一个文件登记当前结构。"""
    try:
        f = argv[argv.index('--approve-structure') + 1]
    except IndexError:
        f = ''
    reason = ''
    if '--reason' in argv:
        i = argv.index('--reason')
        reason = argv[i + 1].strip() if i + 1 < len(argv) else ''
    if not f or f.startswith('-'):
        print('[参数错误] 用法: --approve-structure pages/x.vue --reason "为什么必须改结构"')
        return 2
    if len(reason) < 8:
        print('[参数错误] 必须用 --reason 写清为什么复用现有元素做不到（至少 8 个字）')
        return 2
    ref = baseline_ref(False)
    old = git_show(ref, f)
    if old is None:
        print('[参数错误] %s 不在基线里（新增文件不需要登记）' % f)
        return 2
    if not os.path.exists(f):
        print('[拒绝] 删除基线里的页面不在例外之内')
        return 1
    new = io.open(f, encoding='utf-8').read().replace('\r\n', '\n')
    hard, _ = compare(old, new)
    if not hard:
        print('[拒绝] %s 没有硬边界差异，不需要登记（软边界请用 --approve）' % f)
        return 2
    entries = load_structure()
    entries[f] = {
        '指纹': structure_fingerprint(new),
        '登记时的硬边界差异': hard,
        '理由': reason,
        '依据': STRUCTURE_DECISION,
        '登记时间': time.strftime('%Y-%m-%d %H:%M:%S'),
    }
    write_structure(ref, entries)
    print('[已登记] %s 的结构改动：%s' % (f, '; '.join(hard)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
