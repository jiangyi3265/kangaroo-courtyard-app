# -*- coding: utf-8 -*-
"""独立核实：接线过程中到底动了哪些 Vue 指令（v-if / v-show / v-for / v-else）。

页面保护检查此前七个维度都不看指令，所以"给一个节点加 v-if 让它在某些状态下不显示"
这种最常见的改法完全不会被报出来。这个脚本不依赖那份检查，直接拿基线提交的 .vue
和工作区的 .vue 比指令，自己数一遍。

只读，不改任何文件。
"""
import io
import re
import subprocess
import sys

APP = r'C:\Users\jiangyi\Desktop\袋鼠旅游小程序\袋鼠旅游'
DIRECTIVES = ('v-if', 'v-else-if', 'v-else', 'v-show', 'v-for')
COMMENT_RE = re.compile(r'<!--.*?-->', re.S)
TAG_RE = re.compile(r'<(/?)([A-Za-z][\w.:-]*)((?:"[^"]*"|\'[^\']*\'|[^>"\'])*)>', re.S)


def git(args):
    return subprocess.run(['git'] + args, cwd=APP, capture_output=True,
                          encoding='utf-8', errors='replace')


def baseline_ref():
    out = git(['rev-list', '--max-parents=0', 'HEAD']).stdout.split()
    return out[-1]


def template_of(text):
    m = re.search(r'<template[^>]*>(.*)</template>', text, re.S)
    return COMMENT_RE.sub('', m.group(1)) if m else ''


def directive_list(tpl):
    """每个开标签上出现的指令与取值，按出现顺序。"""
    out = []
    for m in TAG_RE.finditer(tpl):
        if m.group(1):
            continue
        tag, attrs = m.group(2), m.group(3)
        for d in DIRECTIVES:
            for am in re.finditer(
                    r'(?:^|\s)(%s)(?:\s*=\s*(?:"([^"]*)"|\'([^\']*)\'))?' % d, attrs):
                val = am.group(2) if am.group(2) is not None else (am.group(3) or '')
                out.append('%s %s="%s"' % (tag, am.group(1), val.strip()))
    return out


def main():
    ref = baseline_ref()
    files = [f for f in git(['ls-tree', '-r', '--name-only', ref]).stdout.splitlines()
             if f.endswith('.vue') and not f.startswith('dist/')]
    total_add = total_del = 0
    changed_files = 0
    print('基线提交 %s，比对 %d 个 .vue\n' % (ref[:12], len(files)))
    for f in files:
        old = git(['show', '%s:%s' % (ref, f)]).stdout
        if not old:
            continue
        try:
            new = io.open(APP + '\\' + f.replace('/', '\\'), encoding='utf-8').read()
        except IOError:
            continue
        a = directive_list(template_of(old.replace('\r\n', '\n')))
        b = directive_list(template_of(new.replace('\r\n', '\n')))
        if a == b:
            continue
        from collections import Counter
        ca, cb = Counter(a), Counter(b)
        added = sorted((cb - ca).elements())
        removed = sorted((ca - cb).elements())
        if not added and not removed:
            print('%-38s 指令只是换了顺序' % f)
            changed_files += 1
            continue
        changed_files += 1
        total_add += len(added)
        total_del += len(removed)
        print('%s' % f)
        for x in removed:
            print('    - %s' % x)
        for x in added:
            print('    + %s' % x)
        print('')

    print('=' * 66)
    print('指令有变化的文件: %d    新增指令: %d    删除指令: %d'
          % (changed_files, total_add, total_del))
    return 0


if __name__ == '__main__':
    sys.exit(main())
