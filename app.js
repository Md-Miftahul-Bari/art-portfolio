/* ============================================================
   Mafiul Wahid Shihab — Portfolio interactions (v2)
   ============================================================ */
(function () {
  "use strict";
  var ART = (window.ARTWORKS || []).slice();
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var FILTERS = [
    { key: "all", label: "All Work" },
    { key: "Wall Paintings", label: "Murals & Walls" },
    { key: "Digital Works", label: "Digital & Illustration" },
    { key: "Graphic Design", label: "Graphic Design" },
    { key: "BFA Studio Work", label: "Studio Work" }
  ];
  var GROUP_ORDER = { "Wall Paintings":0, "Digital Works":1, "Graphic Design":2, "BFA Studio Work":3 };
  var GROUP_LABEL = { "Wall Paintings":"Mural / Wall", "Digital Works":"Digital", "Graphic Design":"Graphic Design", "BFA Studio Work":"Studio" };

  var COLL_ORDER = ["Brews & Bakes","Taroof","The Momo Walls","BRAC Learning Center","Charukola Walls",
    "Aparajita","Sugar Art Studio","Climate Awareness","Noboridha Rag Wall","The Hunger Dine","The Momo",
    "Digital Illustrations","Posters","Program Titles","Logo Design","Menu Design","Box Design","T-Shirt","BFA Studio Work"];
  function collRank(d){ var i = COLL_ORDER.indexOf(d); return i === -1 ? 999 : i; }

  ART.sort(function (a, b) {
    var g = (GROUP_ORDER[a.group]||9) - (GROUP_ORDER[b.group]||9); if (g) return g;
    var c = collRank(a.display) - collRank(b.display); if (c) return c;
    return a.id.localeCompare(b.id, undefined, { numeric:true });
  });

  var countNum = document.getElementById("countNum"); if (countNum) countNum.textContent = ART.length;
  var yr = document.getElementById("yr"); if (yr) yr.textContent = new Date().getFullYear();
  function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]; }); }

  /* ---------- CAROUSEL ---------- */
  var FEATURED = ["aparajita","image162","the-momo-final--3","the-momo-eid-poster","charukola-2",
    "swader-haari-logo-01","image160","eid-poster---2026","img-20231214-164220","the-momo-tee-1-0","image147"];
  function pickFeatured(){
    var picks = [];
    FEATURED.forEach(function(id){ var hit = ART.find(function(a){return a.id===id;}); if (hit && picks.indexOf(hit)<0) picks.push(hit); });
    // fill with any remaining non-landscape works first, then anything
    for (var i=0; i<ART.length && picks.length<8; i++){ if (picks.indexOf(ART[i])<0 && ART[i].orientation!=="landscape") picks.push(ART[i]); }
    for (var j=0; j<ART.length && picks.length<8; j++){ if (picks.indexOf(ART[j])<0) picks.push(ART[j]); }
    return picks.slice(0,8);
  }
  var feat = pickFeatured();
  var track = document.getElementById("carTrack");
  var dotsWrap = document.getElementById("carDots");
  var cur = 0, timer = null;

  feat.forEach(function(a, i){
    var s = document.createElement("div");
    s.className = "slide" + (i===0 ? " is-active" : "");
    s.setAttribute("role","group"); s.setAttribute("aria-label", (i+1)+" of "+feat.length+": "+a.display);
    var img = new Image(); img.decoding="async"; img.alt = a.display;
    img.loading = i<2 ? "eager" : "lazy";
    s.style.backgroundImage = "url("+a.placeholder+")"; s.style.backgroundSize="cover"; s.style.backgroundPosition="center";
    img.src = (i<2 ? a.full : a.thumb);
    if (i>=2){ img.addEventListener("load", function(){ /* upgrade handled on activate */ }); }
    var cap = document.createElement("div"); cap.className="slide__cap";
    cap.innerHTML = "<b>"+esc(a.display)+"</b><span>"+esc(GROUP_LABEL[a.group]||"")+"</span>";
    s.appendChild(img); s.appendChild(cap);
    s.addEventListener("click", function(){ openLB(ART.indexOf(a)); });
    track.appendChild(s);

    var d = document.createElement("button");
    d.type="button"; d.setAttribute("aria-label","Go to "+a.display);
    if (i===0) d.className="is-active";
    d.addEventListener("click", function(){ go(i, true); });
    dotsWrap.appendChild(d);
  });

  var slides = track.querySelectorAll(".slide");
  var dots = dotsWrap.querySelectorAll("button");
  function go(n, user){
    if (!slides.length) return;
    cur = (n + slides.length) % slides.length;
    slides.forEach(function(s,i){
      var on = i===cur; s.classList.toggle("is-active", on);
      if (on){ var im=s.querySelector("img"); var a=feat[i]; if (im && a && im.src.indexOf(a.full)<0){ var hi=new Image(); hi.onload=function(){im.src=a.full;}; hi.src=a.full; } }
    });
    dots.forEach(function(d,i){ d.classList.toggle("is-active", i===cur); });
    if (user) restart();
  }
  function next(){ go(cur+1); } function prev(){ go(cur-1); }
  function restart(){ if (timer) clearInterval(timer); if (!reduce && slides.length>1) timer = setInterval(next, 4800); }
  document.getElementById("carNext").addEventListener("click", function(){ go(cur+1, true); });
  document.getElementById("carPrev").addEventListener("click", function(){ go(cur-1, true); });
  var car = document.getElementById("carousel");
  car.addEventListener("mouseenter", function(){ if (timer) clearInterval(timer); });
  car.addEventListener("mouseleave", restart);
  document.addEventListener("visibilitychange", function(){ if (document.hidden){ if(timer) clearInterval(timer);} else restart(); });
  // swipe
  var sx=0, sdx=0;
  track.addEventListener("touchstart", function(e){ sx=e.touches[0].clientX; sdx=0; }, {passive:true});
  track.addEventListener("touchmove", function(e){ sdx=e.touches[0].clientX - sx; }, {passive:true});
  track.addEventListener("touchend", function(){ if (Math.abs(sdx)>42){ sdx<0 ? go(cur+1,true) : go(cur-1,true); } });
  restart();

  /* ---------- GALLERY ---------- */
  var gallery = document.getElementById("gallery");
  var cards = [];
  var io = ("IntersectionObserver" in window) ? new IntersectionObserver(function(entries, obs){
    entries.forEach(function(e){ if (e.isIntersecting){ load(e.target); obs.unobserve(e.target); } });
  }, { rootMargin:"500px 0px" }) : null;
  function load(img){ var r=img.getAttribute("data-src"); if (!r) return; img.src=r;
    img.addEventListener("load", function(){ img.classList.add("is-loaded"); }); img.removeAttribute("data-src"); }

  ART.forEach(function(a, i){
    var card = document.createElement("button");
    card.className="card"; card.type="button"; card.setAttribute("data-group", a.group);
    card.setAttribute("aria-label","View "+a.display);
    var media = document.createElement("div"); media.className="card__media";
    media.style.backgroundImage="url("+a.placeholder+")"; media.style.aspectRatio=(a.w+"/"+a.h);
    var img = document.createElement("img"); img.className="card__img"; img.width=a.w; img.height=a.h;
    img.alt = a.display + " — " + (GROUP_LABEL[a.group]||""); img.decoding="async"; img.setAttribute("data-src", a.thumb);
    var cap = document.createElement("div"); cap.className="card__cap";
    cap.innerHTML = '<div class="card__coll">'+esc(a.display)+'</div><div class="card__grp">'+esc(GROUP_LABEL[a.group]||"")+'</div>';
    media.appendChild(img); card.appendChild(media); card.appendChild(cap);
    gallery.appendChild(card); cards.push(card);
    if (io) io.observe(img); else load(img);
    card.addEventListener("click", function(){ openLB(i); });
  });

  /* ---------- FILTERS ---------- */
  var filterBar = document.getElementById("filters");
  FILTERS.forEach(function(f){
    var n = f.key==="all" ? ART.length : ART.filter(function(a){return a.group===f.key;}).length;
    if (f.key!=="all" && n===0) return;
    var b=document.createElement("button"); b.type="button"; b.setAttribute("role","tab");
    b.innerHTML = f.label + '<span class="n">'+n+'</span>';
    if (f.key==="all") b.classList.add("is-active");
    b.addEventListener("click", function(){
      Array.prototype.forEach.call(filterBar.children, function(c){ c.classList.remove("is-active"); });
      b.classList.add("is-active");
      cards.forEach(function(card){
        var show = f.key==="all" || card.getAttribute("data-group")===f.key;
        card.classList.toggle("is-hidden", !show);
        if (show){ var im=card.querySelector("img[data-src]"); if (im) load(im); }
      });
    });
    filterBar.appendChild(b);
  });

  /* ---------- TIMELINE ---------- */
  var TL = [
    { when:"Dec 2024 — Present", org:"Rajshahi University Debating Forum", role:"Executive Member",
      pts:["Convener, RUDF Intra AP Tournament 2025","Co-Convener, RUDF Invitationals 2025","Co-Convener, RUDF Intra BP Tournament 2024"] },
    { when:"Oct 2019 — 2020", org:"Star Student’s Debating Club (SSDC)", role:"Assistant General Secretary",
      pts:["Convener, SSDC IC 2018","Convener, SSDC IS 2018"] },
    { when:"Oct 2018 — 2020", org:"Shobar Mukhe Hashi", role:"Advisor — community initiative",
      pts:["Convener, Eid for Street Children 2018"] },
    { when:"Jan 2013 — 2017", org:"Rajshahi Collegiate School Debating Club", role:"Vice President",
      pts:["Co-Convener, 5th RCSDC Interclass Debate Tournament 2016"] }
  ];
  var tlEl = document.getElementById("timeline");
  if (tlEl) TL.forEach(function(t){
    var row=document.createElement("div"); row.className="tl reveal";
    row.innerHTML = '<div class="tl__when">'+esc(t.when)+'</div><div class="tl__main"><div class="tl__org">'+esc(t.org)+
      '</div><div class="tl__role">'+esc(t.role)+'</div><ul class="tl__pts">'+
      t.pts.map(function(p){return "<li>"+esc(p)+"</li>";}).join("")+'</ul></div>';
    tlEl.appendChild(row);
  });

  /* ---------- LIGHTBOX ---------- */
  var lb=document.getElementById("lb"), lbImg=document.getElementById("lbImg"), lbCap=document.getElementById("lbCap"),
      lbClose=document.getElementById("lbClose"), lbPrev=document.getElementById("lbPrev"), lbNext=document.getElementById("lbNext");
  var lcur=-1, lastFocus=null;
  function visibleIdx(){ return cards.map(function(c,i){return c.classList.contains("is-hidden")?-1:i;}).filter(function(i){return i>=0;}); }
  function openLB(i){ if(i<0) return; lcur=i; lastFocus=document.activeElement; renderLB(); lb.hidden=false; document.body.style.overflow="hidden"; lbClose.focus(); }
  function closeLB(){ lb.hidden=true; document.body.style.overflow=""; if(lastFocus&&lastFocus.focus) lastFocus.focus(); }
  function stepLB(d){ var vis=visibleIdx(); if(!vis.length) return; var p=vis.indexOf(lcur); if(p<0){ lcur=vis[0]; } else { p=(p+d+vis.length)%vis.length; lcur=vis[p]; } renderLB(); }
  function renderLB(){ var a=ART[lcur]; if(!a) return; lbImg.style.opacity=0; var full=new Image();
    full.onload=function(){ lbImg.src=full.src; lbImg.style.opacity=1; }; full.src=a.full; lbImg.alt=a.display;
    lbCap.innerHTML="<b>"+esc(a.display)+"</b>"+esc(GROUP_LABEL[a.group]||""); }
  lbClose.addEventListener("click", closeLB);
  lbPrev.addEventListener("click", function(){ stepLB(-1); });
  lbNext.addEventListener("click", function(){ stepLB(1); });
  lb.addEventListener("click", function(e){ if(e.target===lb) closeLB(); });
  document.addEventListener("keydown", function(e){ if(lb.hidden) return;
    if(e.key==="Escape") closeLB(); else if(e.key==="ArrowLeft") stepLB(-1); else if(e.key==="ArrowRight") stepLB(1); });
  var lsx=0, ldx=0;
  lb.addEventListener("touchstart", function(e){ lsx=e.touches[0].clientX; ldx=0; }, {passive:true});
  lb.addEventListener("touchmove", function(e){ ldx=e.touches[0].clientX-lsx; }, {passive:true});
  lb.addEventListener("touchend", function(){ if(Math.abs(ldx)>45){ ldx<0?stepLB(1):stepLB(-1); } });

  /* ---------- MOBILE MENU ---------- */
  var burger=document.getElementById("burger"), menu=document.getElementById("menu");
  function setMenu(open){
    document.body.classList.toggle("menu-open", open);
    burger.setAttribute("aria-expanded", open?"true":"false");
    if (open){ menu.hidden=false; requestAnimationFrame(function(){ menu.classList.add("is-open"); }); document.body.style.overflow="hidden"; }
    else { menu.classList.remove("is-open"); document.body.style.overflow=""; setTimeout(function(){ if(!document.body.classList.contains("menu-open")) menu.hidden=true; }, 400); }
  }
  burger.addEventListener("click", function(){ setMenu(!document.body.classList.contains("menu-open")); });
  menu.querySelectorAll("a").forEach(function(a){ a.addEventListener("click", function(){ setMenu(false); }); });
  document.addEventListener("keydown", function(e){ if(e.key==="Escape" && document.body.classList.contains("menu-open")) setMenu(false); });

  /* ---------- NAV STUCK + REVEAL ---------- */
  var nav=document.getElementById("nav");
  window.addEventListener("scroll", function(){ nav.classList.toggle("is-stuck", window.scrollY>24); }, {passive:true});
  if ("IntersectionObserver" in window){
    var rio=new IntersectionObserver(function(es){ es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add("is-in"); rio.unobserve(e.target); } }); }, { rootMargin:"-8% 0px" });
    document.querySelectorAll(".sec__head, .about__grid, .reco__grid, .contact__in, .tl").forEach(function(el){ el.classList.add("reveal"); rio.observe(el); });
  }
})();
