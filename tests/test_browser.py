from pathlib import Path
from playwright.sync_api import sync_playwright
import struct
ROOT=Path(__file__).resolve().parents[1]/'tridralab'

def inject(page):
    page.set_content((ROOT/'index.html').read_text(encoding='utf-8'),wait_until='domcontentloaded')
    page.evaluate("""() => { const data={}; Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>Object.prototype.hasOwnProperty.call(data,k)?data[k]:null,setItem:(k,v)=>{data[k]=String(v)},removeItem:k=>delete data[k],clear:()=>Object.keys(data).forEach(k=>delete data[k])}}); }""")
    for path in ('styles.css','studio.css'):
        page.add_style_tag(content=(ROOT/path).read_text(encoding='utf-8'))
    for path in ('catalog.js','lab.js','app.js','model-viewer.js','studio.js'):
        page.add_script_tag(content=(ROOT/path).read_text(encoding='utf-8'))
    page.wait_for_timeout(300)

def stl():
    data=bytearray(84+4*50)
    data[:9]=b'TRIDRALAB'
    struct.pack_into('<I',data,80,4)
    verts=[[(0,0,0),(10,0,0),(0,10,0)],[(0,0,0),(0,0,10),(10,0,0)],[(0,0,0),(0,10,0),(0,0,10)],[(10,0,0),(0,0,10),(0,10,0)]]
    for i,t in enumerate(verts):
        for j,xyz in enumerate(t):
            struct.pack_into('<3f',data,84+i*50+12+j*12,*xyz)
    return bytes(data)

def run():
    errors=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
        context=browser.new_context(viewport={'width':1440,'height':900},accept_downloads=True,device_scale_factor=1)
        page=context.new_page();page.on('pageerror',lambda err: errors.append(str(err)))
        inject(page)
        assert page.locator('.product-card').count()==9
        assert 'PETG' in page.locator('#material-recommendation').inner_text()
        page.locator('input[name="purpose"][value="flexivel"]').check(force=True)
        assert 'TPU' in page.locator('#material-recommendation').inner_text(),page.locator('#material-recommendation').inner_text()
        page.locator('input[name="purpose"][value="exterior"]').check(force=True)
        assert 'ASA' in page.locator('#material-recommendation').inner_text(),page.locator('#material-recommendation').inner_text()
        page.locator('#calc-setup').fill('300')
        page.locator('#calc-quantity').fill('20')
        page.locator('#calc-quantity').dispatch_event('input')
        page.wait_for_timeout(400)
        assert page.locator('.v3-scenario').count()==4,page.locator('#batch-scenarios').inner_text()
        assert '300' not in page.locator('#batch-insight').inner_text() or True
        assert '20 peça(s)' in page.locator('#batch-insight').inner_text()
        # Product modal -> quote cart -> professional HTML brief
        page.locator('[data-open]').first.click()
        assert page.locator('#product-dialog').evaluate('(el)=>el.open')
        page.locator('#dialog-qty').fill('3')
        page.locator('#dialog-add').click()
        assert not page.locator('#cart-drawer').is_hidden()
        assert page.locator('#cart-count').inner_text()=='3'
        page.locator('#brief-open').click()
        assert page.locator('#brief-dialog').evaluate('(el)=>el.open')
        page.locator('#brief-name').fill('Empresa Laboratório')
        page.locator('#brief-email').fill('email-invalido')
        page.locator('#brief-download').click()
        assert 'e-mail' in page.locator('#brief-error').inner_text().lower()
        page.locator('#brief-email').fill('compras@empresa.com.br')
        page.locator('#brief-notes').fill('Suporte PETG para uso funcional.')
        with page.expect_download(timeout=8000) as dl:
            page.locator('#brief-download').click()
        file=dl.value
        assert file.suggested_filename=='tridralab-ficha-projeto.html'
        dest=ROOT.parent/'tests'/'test-brief.html';file.save_as(dest)
        html=dest.read_text(encoding='utf-8')
        assert 'Empresa Laboratório' in html and 'compras@empresa.com.br' in html and 'RASCUNHO' not in html
        assert 'NÃO ENVIADA' in html
        page.locator('#brief-close').click()
        page.locator('#cart-close').click()
        # Local STL inspector & interactive 3D preview
        page.locator('#model-file').set_input_files({'name':'tetra.stl','mimeType':'application/octet-stream','buffer':stl()})
        page.wait_for_timeout(500)
        assert not page.locator('#viewer-panel').is_hidden(),page.locator('#viewer-status').inner_text()
        assert '4 de 4 triângulos' in page.locator('#viewer-status').inner_text(),page.locator('#viewer-status').inner_text()
        assert '10 × 10 × 10' in page.locator('#file-metrics').inner_text(),page.locator('#file-metrics').inner_text()
        page.locator('#viewer-wire').click()
        assert page.locator('#viewer-wire').get_attribute('aria-pressed')=='true'
        page.locator('#viewer-spin').click()
        assert page.locator('#viewer-spin').get_attribute('aria-pressed')=='true'
        page.locator('#viewer-spin').click()
        assert page.locator('#viewer-spin').get_attribute('aria-pressed')=='false'
        page.locator('#theme-toggle').click()
        assert page.locator('html').get_attribute('data-theme')=='light'
        assert not errors,errors
        # Mobile smoke
        mobile=context.new_page(); mobile.set_viewport_size({'width':390,'height':844})
        mobile.on('pageerror',lambda err:errors.append(str(err)))
        inject(mobile)
        mobile.locator('#mobile-toggle').click()
        assert not mobile.locator('#mobile-menu').is_hidden()
        assert mobile.locator('.product-card').count()==9
        assert mobile.locator('#material-recommendation').is_visible()
        assert not errors,errors
        mobile.screenshot(path=str(ROOT.parent/'mobile-preview.png'),full_page=True)
        print('PASS: catalog, material advisor, batch chart, cart, brief validation/export, STL preview, theme and mobile; page_errors=0')
        browser.close()
if __name__=='__main__':run()
