import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
const source=fs.readFileSync(new URL('../common/screen.js',import.meta.url),'utf8').replace(/^import .*$/mg,'').replace(/export /g,'')
function fixture(){const calls=[],context={recruitmentEnabled:{value:true},uni:{navigateTo:o=>calls.push(['navigate',o]),redirectTo:o=>calls.push(['redirect',o]),showToast:o=>calls.push(['toast',o])}};vm.createContext(context);vm.runInContext(source+'\nthis.go=go',context);return{calls,go:context.go}}
test('stack full preserves destination and reports redirect failure',()=>{const h=fixture();h.go('/pages/staff/rooms?storeId=12');h.calls[0][1].fail({errMsg:'navigateTo:fail webview count limit exceed'});assert.equal(h.calls[1][0],'redirect');assert.equal(h.calls[1][1].url,'/pages/staff/rooms?storeId=12');h.calls[1][1].fail({errMsg:'redirectTo:fail not found'});assert.equal(h.calls[2][0],'toast')})
test('non-cancellation navigation failures are visible and do not change destination',()=>{const h=fixture();h.go('/pages/staff/stay-orders');h.calls[0][1].fail({errMsg:'navigateTo:fail page not found'});assert.equal(h.calls[1][0],'toast');assert.equal(h.calls.length,2)})
test('rapid-click cancellation does not redirect or show an error',()=>{for(const msg of ['locked','cancel']){const h=fixture();h.go('/pages/staff/rooms');h.calls[0][1].fail({errMsg:msg});assert.equal(h.calls.length,1)}})
