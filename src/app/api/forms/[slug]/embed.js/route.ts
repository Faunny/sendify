// GET /api/forms/[slug]/embed.js
//
// Returns a self-contained JavaScript snippet the merchant pastes in their
// Shopify theme.liquid (or any HTML page). It renders the form into a target
// container — either a <div id="sendify-form-{slug}"> the merchant places
// inline, OR auto-injects a popup according to behavior config.
//
// Cached for 60s at the edge so the merchant's store doesn't hammer Sendify.

import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FieldDef = { id: string; type: string; label: string; placeholder?: string; required?: boolean; options?: any };

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const form = await prisma.form.findUnique({
    where: { slug },
    select: { id: true, slug: true, kind: true, status: true, fields: true, design: true, behavior: true },
  });

  if (!form || form.status !== "PUBLISHED") {
    return new Response(`/* Sendify form ${slug} not found or unpublished */`, {
      status: 404,
      headers: { "Content-Type": "application/javascript; charset=utf-8" },
    });
  }

  // Bump impressions (best effort).
  prisma.form.update({ where: { id: form.id }, data: { impressions: { increment: 1 } } }).catch(() => {});

  const fields   = (form.fields   ?? []) as FieldDef[];
  const design   = (form.design   ?? {}) as { headline?: string; subheadline?: string; ctaLabel?: string; theme?: string; palette?: { bg?: string; text?: string; primary?: string }; backgroundImageUrl?: string | null };
  const behavior = (form.behavior ?? {}) as { successMessage?: string; popupTrigger?: { kind: string; value?: number } | null };

  const apiBase = process.env.NEXT_PUBLIC_APP_URL ?? "https://sendify.divain.space";
  const submitUrl = `${apiBase}/api/forms/${slug}/submit`;
  const palette = {
    bg:      design.palette?.bg      ?? "#FFFFFF",
    text:    design.palette?.text    ?? "#1A1A1A",
    primary: design.palette?.primary ?? "#000000",
  };
  const cfg = JSON.stringify({ slug, kind: form.kind, fields, design, palette, behavior, submitUrl });

  // Server-side bundle — no external deps, vanilla DOM, ~3KB minified.
  const js = `(function(){
  if(window.__sendifyForm_${slug.replace(/[^a-z0-9]/gi, "_")}) return;
  window.__sendifyForm_${slug.replace(/[^a-z0-9]/gi, "_")} = true;
  var CFG = ${cfg};

  function css(){
    return [
      ".sf-form{box-sizing:border-box;font-family:Inter,-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;background:"+CFG.palette.bg+";color:"+CFG.palette.text+";padding:24px;border-radius:12px;max-width:420px;width:100%;}",
      ".sf-form *,.sf-form *::before,.sf-form *::after{box-sizing:inherit;}",
      ".sf-form h2{font-family:Outfit,Inter,Helvetica,sans-serif;font-size:22px;font-weight:600;margin:0 0 8px;line-height:1.2;}",
      ".sf-form p{margin:0 0 16px;color:"+CFG.palette.text+";opacity:.7;font-size:13px;line-height:1.5;}",
      ".sf-field{margin-bottom:10px;}",
      ".sf-field label{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:"+CFG.palette.text+";opacity:.65;margin-bottom:4px;}",
      ".sf-field input,.sf-field select{width:100%;padding:10px 12px;border:1px solid rgba(0,0,0,.15);border-radius:6px;font:inherit;background:"+CFG.palette.bg+";color:"+CFG.palette.text+";}",
      ".sf-field input:focus{outline:2px solid "+CFG.palette.primary+";outline-offset:1px;}",
      ".sf-field-consent{display:flex;align-items:flex-start;gap:8px;font-size:11px;line-height:1.45;color:"+CFG.palette.text+";opacity:.75;margin:10px 0 14px;}",
      ".sf-field-consent input{margin-top:2px;}",
      ".sf-btn{display:block;width:100%;padding:13px 24px;background:"+CFG.palette.primary+";color:"+CFG.palette.bg+";border:0;border-radius:40px;font:inherit;font-size:11px;text-transform:uppercase;letter-spacing:1px;font-weight:500;cursor:pointer;}",
      ".sf-btn:disabled{opacity:.5;cursor:wait;}",
      ".sf-msg{font-size:13px;margin-top:10px;padding:10px;border-radius:6px;}",
      ".sf-msg.ok{background:rgba(0,150,80,.08);color:#0a7a3e;}",
      ".sf-msg.err{background:rgba(200,40,40,.08);color:#b8331f;}",
      ".sf-popup-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:99998;display:flex;align-items:center;justify-content:center;padding:16px;animation:sf-fade .25s ease;}",
      ".sf-popup-close{position:absolute;top:10px;right:14px;background:transparent;border:0;font-size:24px;cursor:pointer;color:"+CFG.palette.text+";opacity:.5;line-height:1;}",
      "@keyframes sf-fade{from{opacity:0;}to{opacity:1;}}",
    ].join("");
  }

  function injectCss(){
    if(document.getElementById("sf-css-"+CFG.slug))return;
    var s=document.createElement("style");s.id="sf-css-"+CFG.slug;s.appendChild(document.createTextNode(css()));document.head.appendChild(s);
  }

  function escapeHtml(s){return String(s).replace(/[&<>"']/g,function(c){return ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]);});}

  function buildForm(){
    var form=document.createElement("form");form.className="sf-form";form.noValidate=true;
    form.innerHTML="<h2>"+escapeHtml(CFG.design.headline||"Suscríbete")+"</h2>"+
      (CFG.design.subheadline?"<p>"+escapeHtml(CFG.design.subheadline)+"</p>":"");

    CFG.fields.forEach(function(f){
      if(f.type==="consent")return; // rendered separately
      var wrap=document.createElement("div");wrap.className="sf-field";
      wrap.innerHTML="<label>"+escapeHtml(f.label)+(f.required?" *":"")+"</label>"+
        (f.type==="select"
          ? "<select name=\\""+escapeHtml(f.id)+"\\" "+(f.required?"required":"")+">"+
              (f.options||[]).map(function(o){return "<option value=\\""+escapeHtml(o.value||o)+"\\">"+escapeHtml(o.label||o)+"</option>";}).join("")+"</select>"
          : "<input type=\\""+escapeHtml(f.type==="email"?"email":(f.type==="tel"?"tel":"text"))+"\\" name=\\""+escapeHtml(f.id)+"\\" placeholder=\\""+escapeHtml(f.placeholder||"")+"\\" "+(f.required?"required":"")+">");
      form.appendChild(wrap);
    });

    var consent=CFG.fields.filter(function(f){return f.type==="consent";})[0];
    if(consent){
      var c=document.createElement("label");c.className="sf-field-consent";
      c.innerHTML="<input type=\\"checkbox\\" name=\\""+escapeHtml(consent.id)+"\\" "+(consent.required?"required":"")+"><span>"+escapeHtml(consent.label)+"</span>";
      form.appendChild(c);
    }

    var btn=document.createElement("button");btn.type="submit";btn.className="sf-btn";btn.textContent=CFG.design.ctaLabel||"Enviar";
    form.appendChild(btn);

    var msg=document.createElement("div");msg.className="sf-msg";msg.style.display="none";
    form.appendChild(msg);

    form.addEventListener("submit",function(ev){
      ev.preventDefault();
      btn.disabled=true;msg.style.display="none";
      var fd=new FormData(form),data={};
      fd.forEach(function(v,k){data[k]=v;});
      // Convert checkbox values to booleans for "consent" field(s)
      CFG.fields.forEach(function(f){if(f.type==="consent")data[f.id]=fd.has(f.id);});
      fetch(CFG.submitUrl,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)})
        .then(function(r){return r.json();})
        .then(function(j){
          if(!j.ok){msg.className="sf-msg err";msg.textContent=j.error||"Algo ha fallado";msg.style.display="block";btn.disabled=false;return;}
          msg.className="sf-msg ok";msg.textContent=j.successMessage||"¡Gracias!";msg.style.display="block";
          if(j.redirect){setTimeout(function(){window.location.href=j.redirect;},800);}
        })
        .catch(function(){msg.className="sf-msg err";msg.textContent="Error de red. Inténtalo de nuevo.";msg.style.display="block";btn.disabled=false;});
    });
    return form;
  }

  function renderInline(){
    var target=document.getElementById("sendify-form-"+CFG.slug);
    if(!target){console.warn("[sendify] No target div for slug "+CFG.slug+". Add <div id=\\"sendify-form-"+CFG.slug+"\\"></div> where you want the form.");return;}
    target.innerHTML="";target.appendChild(buildForm());
  }

  function renderPopup(){
    if(localStorage.getItem("sf-dismissed-"+CFG.slug))return;
    var overlay=document.createElement("div");overlay.className="sf-popup-overlay";
    var card=document.createElement("div");card.style.position="relative";
    var close=document.createElement("button");close.className="sf-popup-close";close.innerHTML="&times;";
    close.addEventListener("click",function(){overlay.remove();localStorage.setItem("sf-dismissed-"+CFG.slug,"1");});
    card.appendChild(close);card.appendChild(buildForm());overlay.appendChild(card);
    document.body.appendChild(overlay);
  }

  function init(){
    injectCss();
    if(CFG.kind==="POPUP"||CFG.kind==="INLINE"&&CFG.behavior&&CFG.behavior.popupTrigger){
      var t=CFG.behavior&&CFG.behavior.popupTrigger;
      if(!t||t.kind==="delay")setTimeout(renderPopup,(t&&t.value)||8000);
      else if(t.kind==="exit-intent")document.addEventListener("mouseout",function(e){if(e.clientY<=0)renderPopup();},{once:true});
      else renderPopup();
    } else {
      renderInline();
    }
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);
  else init();
})();
`;

  return new Response(js, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=60, s-maxage=60",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
