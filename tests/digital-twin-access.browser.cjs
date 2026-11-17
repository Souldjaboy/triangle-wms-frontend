// Local mocked HTTP only. No real account, credential, stock or production write.
const {chromium}=require('@playwright/test');const assert=require('node:assert/strict');
const base=process.env.TWIN_TEST_URL||'http://127.0.0.1:3101';if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Localhost only');
(async()=>{const browser=await chromium.launch({executablePath:process.env.TWIN_BROWSER_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  const context=await browser.newContext();const token='test.'+Buffer.from(JSON.stringify({role:'admin',company_id:1})).toString('base64url')+'.fixture';
  await context.addCookies([{name:'triangle_business_token',value:token,url:base}]);
  let canView=false,owner=false,allowed=false,warehouseReads=0,updates=[];
  await context.route('**/api/**',async route=>{
   const p=new URL(route.request().url()).pathname;let body={};
   if(p.endsWith('/digital-twin/access'))body={canView,canManage:owner};
   else if(p.endsWith('/digital-twin/access/users'))body={users:[{id:1,email:'owner@test',fullname:'Propriétaire test',role:'super_admin',is_active:true,is_owner:true,allowed:true},{id:2,email:'reader@test',fullname:'Lecteur test',role:'admin',is_active:true,is_owner:false,allowed}]};
   else if(p.endsWith('/digital-twin/access/users/2')){allowed=route.request().postDataJSON().allowed;updates.push(allowed);body={user_id:2,allowed};}
   else if(p.endsWith('/digital-twin/warehouses')){warehouseReads++;body={warehouses:[],as_of:new Date().toISOString()};}
   await route.fulfill({json:body});
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/stocks/digital-twin');
  await page.getByRole('heading',{name:'Accès au module indisponible'}).waitFor();assert.equal(warehouseReads,0);
  canView=true;owner=true;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await page.getByRole('button',{name:'Gérer les accès',exact:true}).click();
  const check=page.getByRole('checkbox',{name:'Autoriser reader@test'});await check.waitFor();assert.equal(await check.isChecked(),false);
  assert.equal(await page.getByRole('checkbox',{name:'Autoriser owner@test'}).isDisabled(),true);
  await check.check();await page.waitForFunction(()=>document.querySelector('input[aria-label="Autoriser reader@test"]').checked);
  await check.uncheck();assert.deepEqual(updates,[true,false]);
  canView=false;owner=false;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await page.getByRole('heading',{name:'Accès au module indisponible'}).waitFor();assert.equal(await page.locator('.dt-shell').count(),0);assert.equal(await page.getByRole('checkbox').count(),0);
  assert.deepEqual(errors,[]);console.log('PASS: denied page does not fetch warehouses; owner manages; grant/revoke; owner cannot be unchecked; revoked screen clears.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
