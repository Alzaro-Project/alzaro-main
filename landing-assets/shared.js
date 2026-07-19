/* ==========================================================================
   Alzaro landing pages — shared behaviour layer (no dependencies).
   Provides: nav condense + mobile menu, staggered scroll reveals, count-up
   stats, tilt-on-hover cards, magnetic CTAs, FAQ accordion, logo marquee,
   and AlzaroHero — a lazy Three.js bootstrapper with poster fallback.
   Load with <script src="/landing-assets/shared.js" defer></script>.
   ========================================================================== */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(pointer: fine)").matches;

  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  /* ---------- Sticky nav: condense on scroll + mobile menu ---------- */
  function initNav() {
    var nav = document.querySelector(".lnav");
    if (!nav) return;
    var condensed = false;
    function onScroll() {
      var should = window.scrollY > 24;
      if (should !== condensed) {
        condensed = should;
        nav.classList.toggle("is-condensed", condensed);
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    var burger = nav.querySelector(".lnav-burger");
    var menu = document.querySelector(".lnav-mobile");
    if (burger && menu) {
      function place() { menu.style.top = nav.offsetHeight + 8 + "px"; }
      burger.addEventListener("click", function () {
        var open = burger.getAttribute("aria-expanded") === "true";
        burger.setAttribute("aria-expanded", String(!open));
        place();
        menu.classList.toggle("is-open", !open);
      });
      menu.addEventListener("click", function (e) {
        if (e.target.closest("a")) {
          burger.setAttribute("aria-expanded", "false");
          menu.classList.remove("is-open");
        }
      });
    }
  }

  /* ---------- Scroll reveals (staggered) ---------- */
  function initReveals() {
    var targets = [].slice.call(document.querySelectorAll(".reveal, [data-stagger]"));
    if (!targets.length) return;
    if (reduceMotion || !("IntersectionObserver" in window)) {
      targets.forEach(function (el) { el.classList.add("is-in"); });
      return;
    }
    targets.forEach(function (el) {
      if (el.hasAttribute("data-stagger")) {
        var step = parseFloat(el.getAttribute("data-stagger")) || 90;
        [].slice.call(el.children).forEach(function (child, i) {
          child.style.transitionDelay = (i * step) / 1000 + "s";
        });
      }
    });
    var pending = targets.slice();
    function markIn(el) {
      el.classList.add("is-in");
      io.unobserve(el);
      var i = pending.indexOf(el);
      if (i !== -1) pending.splice(i, 1);
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        /* Reveal when entering the viewport — or when already scrolled past
           (fast scrolls can deliver entries late, after the element has gone by). */
        if (entry.isIntersecting || entry.boundingClientRect.top < 0) markIn(entry.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    targets.forEach(function (el) { io.observe(el); });
    /* Belt-and-braces: very fast flings can outrun observer delivery, so a
       throttled scroll check sweeps up anything the observer missed. */
    var sweeping = false;
    function sweep() {
      sweeping = false;
      var vh = window.innerHeight;
      for (var i = pending.length - 1; i >= 0; i--) {
        if (pending[i].getBoundingClientRect().top < vh * 0.92) markIn(pending[i]);
      }
      if (!pending.length) window.removeEventListener("scroll", onScroll);
    }
    function onScroll() {
      if (!sweeping) { sweeping = true; requestAnimationFrame(sweep); }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ---------- Count-up stats: <span data-count="4200" data-decimals="1"> ---------- */
  function initCounters() {
    var els = [].slice.call(document.querySelectorAll("[data-count]"));
    if (!els.length) return;
    function finish(el, target, decimals) {
      el.textContent = target.toLocaleString("en-GB", {
        minimumFractionDigits: decimals, maximumFractionDigits: decimals
      });
    }
    if (reduceMotion || !("IntersectionObserver" in window)) {
      els.forEach(function (el) {
        finish(el, parseFloat(el.getAttribute("data-count")), parseInt(el.getAttribute("data-decimals") || "0", 10));
      });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        io.unobserve(entry.target);
        var el = entry.target;
        var target = parseFloat(el.getAttribute("data-count"));
        var decimals = parseInt(el.getAttribute("data-decimals") || "0", 10);
        var dur = parseInt(el.getAttribute("data-count-dur") || "1600", 10);
        var start = null;
        function tick(now) {
          if (start === null) start = now;
          var p = Math.min((now - start) / dur, 1);
          var eased = 1 - Math.pow(1 - p, 4);
          finish(el, target * eased, decimals);
          if (p < 1) requestAnimationFrame(tick);
          else finish(el, target, decimals);
        }
        requestAnimationFrame(tick);
      });
    }, { threshold: 0.5 });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ---------- Tilt-on-hover cards ---------- */
  function initTilt() {
    if (reduceMotion || !finePointer) return;
    [].slice.call(document.querySelectorAll(".tilt")).forEach(function (card) {
      var max = parseFloat(card.getAttribute("data-tilt-max")) || 7;
      var raf = null, rx = 0, ry = 0;
      function apply() {
        card.style.transform = "perspective(900px) rotateX(" + rx + "deg) rotateY(" + ry + "deg)";
        raf = null;
      }
      card.addEventListener("mousemove", function (e) {
        var r = card.getBoundingClientRect();
        ry = ((e.clientX - r.left) / r.width - 0.5) * max;
        rx = -((e.clientY - r.top) / r.height - 0.5) * max;
        card.classList.add("is-tilting");
        card.style.transition = "transform .12s ease-out";
        if (!raf) raf = requestAnimationFrame(apply);
      });
      card.addEventListener("mouseleave", function () {
        card.classList.remove("is-tilting");
        card.style.transition = "transform .6s cubic-bezier(.22,1,.36,1)";
        card.style.transform = "perspective(900px) rotateX(0deg) rotateY(0deg)";
      });
    });
  }

  /* ---------- Magnetic CTAs ---------- */
  function initMagnetic() {
    if (reduceMotion || !finePointer) return;
    [].slice.call(document.querySelectorAll(".magnetic")).forEach(function (el) {
      var strength = parseFloat(el.getAttribute("data-magnet")) || 0.32;
      var raf = null, tx = 0, ty = 0;
      function apply() {
        el.style.transform = "translate(" + tx + "px," + ty + "px)";
        raf = null;
      }
      el.addEventListener("mousemove", function (e) {
        var r = el.getBoundingClientRect();
        tx = (e.clientX - (r.left + r.width / 2)) * strength;
        ty = (e.clientY - (r.top + r.height / 2)) * strength;
        if (!raf) raf = requestAnimationFrame(apply);
      });
      el.addEventListener("mouseleave", function () {
        tx = 0; ty = 0;
        el.style.transition = "transform .5s cubic-bezier(.22,1,.36,1)";
        el.style.transform = "translate(0,0)";
        setTimeout(function () { el.style.transition = ""; }, 500);
      });
    });
  }

  /* ---------- FAQ accordion ---------- */
  function initFaq() {
    [].slice.call(document.querySelectorAll(".faq-item")).forEach(function (item) {
      var btn = item.querySelector(".faq-q");
      if (!btn) return;
      btn.addEventListener("click", function () {
        var open = item.classList.toggle("is-open");
        btn.setAttribute("aria-expanded", String(open));
      });
    });
  }

  /* ---------- Marquee: duplicate track content for a seamless loop ----------
     The animation starts on the first user interaction rather than at load, so
     the initial paint settles immediately (users notice nothing — any scroll,
     touch or mouse move starts it). ---------- */
  function initMarquee() {
    var tracks = [].slice.call(document.querySelectorAll(".marquee-track"));
    if (!tracks.length) return;
    tracks.forEach(function (track) {
      track.innerHTML += track.innerHTML;
      track.setAttribute("aria-hidden", "false");
      [].slice.call(track.children).slice(track.children.length / 2).forEach(function (c) {
        c.setAttribute("aria-hidden", "true");
      });
    });
    function go() {
      document.querySelectorAll(".marquee").forEach(function (m) { m.classList.add("marquee-live"); });
      ["scroll", "pointermove", "touchstart", "keydown"].forEach(function (ev) {
        window.removeEventListener(ev, go);
      });
    }
    ["scroll", "pointermove", "touchstart", "keydown"].forEach(function (ev) {
      window.addEventListener(ev, go, { passive: true, once: false });
    });
  }

  ready(function () {
    initNav();
    initReveals();
    initCounters();
    initTilt();
    initMagnetic();
    initFaq();
    initMarquee();
  });

  /* ==========================================================================
     AlzaroHero — lazy Three.js hero with poster fallback.

     Usage (per page):
       AlzaroHero.mount({
         container: "#hero-3d",          // .hero-3d element with .hero-poster inside
         cameraZ: 9, fov: 42,
         build: function (THREE, scene, camera, helpers) {
           ...create meshes...
           return { update: function (t, mouse, scroll) { ... } };
         }
       });

     The scene only ever loads when ALL of these hold:
       - no prefers-reduced-motion,
       - viewport ≥ 768px wide (phones keep the static poster),
       - the browser can create a WebGL context,
       - the user hasn't enabled data-saver.
     Three.js r128 is injected after window load, during idle time, so it never
     competes with first paint. If anything fails, the poster simply stays.
     ========================================================================== */
  var THREE_SRC = "/landing-assets/vendor/three-r128.min.js";
  var threePromise = null;

  function loadThree() {
    if (window.THREE) return Promise.resolve(window.THREE);
    if (threePromise) return threePromise;
    threePromise = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = THREE_SRC;
      s.async = true;
      s.onload = function () { window.THREE ? resolve(window.THREE) : reject(new Error("three missing")); };
      s.onerror = function () { reject(new Error("three failed to load")); };
      document.head.appendChild(s);
    });
    return threePromise;
  }

  function afterLoadIdle(fn) {
    function idle() {
      if ("requestIdleCallback" in window) requestIdleCallback(fn, { timeout: 2500 });
      else setTimeout(fn, 700);
    }
    if (document.readyState === "complete") idle();
    else window.addEventListener("load", idle, { once: true });
  }

  window.AlzaroHero = {
    mount: function (opts) {
      var conn = navigator.connection || {};
      if (reduceMotion) return;
      if (window.innerWidth < 768) return;
      if (conn.saveData) return;

      afterLoadIdle(function () {
        loadThree().then(function (THREE) {
          var container = typeof opts.container === "string"
            ? document.querySelector(opts.container) : opts.container;
          if (!container) return;

          var renderer;
          try {
            renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
          } catch (e) { return; }
          renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
          if ("outputEncoding" in renderer) renderer.outputEncoding = THREE.sRGBEncoding;

          var scene = new THREE.Scene();
          var camera = new THREE.PerspectiveCamera(opts.fov || 42, 1, 0.1, 100);
          camera.position.set(0, opts.cameraY || 0, opts.cameraZ || 9);

          var helpers = {
            wire: function (geo, color, opacity) {
              return new THREE.LineSegments(
                new THREE.EdgesGeometry(geo),
                new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: opacity })
              );
            },
            solid: function (geo, color, opts2) {
              var m = new THREE.MeshStandardMaterial(Object.assign({
                color: color, roughness: 0.55, metalness: 0.08, flatShading: true
              }, opts2 || {}));
              return new THREE.Mesh(geo, m);
            },
            softLights: function (skyColor, groundColor, keyColor) {
              scene.add(new THREE.HemisphereLight(skyColor, groundColor, 0.7));
              var key = new THREE.DirectionalLight(keyColor || 0xffffff, 0.55);
              key.position.set(4, 7, 6);
              scene.add(key);
              var fill = new THREE.DirectionalLight(0xffffff, 0.18);
              fill.position.set(-5, -2, 4);
              scene.add(fill);
            }
          };

          var api;
          try {
            api = opts.build(THREE, scene, camera, helpers) || {};
          } catch (e) { renderer.dispose(); return; }

          container.appendChild(renderer.domElement);

          function resize() {
            var w = container.clientWidth, h = container.clientHeight;
            if (!w || !h) return;
            renderer.setSize(w, h);
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
          }
          window.addEventListener("resize", resize, { passive: true });
          resize();

          /* Mouse parallax (lerped in the loop) */
          var mx = 0, my = 0;
          if (finePointer) {
            window.addEventListener("mousemove", function (e) {
              mx = e.clientX / window.innerWidth - 0.5;
              my = e.clientY / window.innerHeight - 0.5;
            }, { passive: true });
          }

          /* Pause when tab hidden or hero scrolled away */
          var pageVisible = true, heroVisible = true;
          document.addEventListener("visibilitychange", function () {
            pageVisible = !document.hidden;
          });
          if ("IntersectionObserver" in window) {
            new IntersectionObserver(function (entries) {
              heroVisible = entries[0].isIntersecting;
            }, { threshold: 0.02 }).observe(container);
          }

          var start = performance.now();
          function frame(now) {
            requestAnimationFrame(frame);
            if (!pageVisible || !heroVisible) return;
            var t = (now - start) / 1000;
            var rect = container.getBoundingClientRect();
            var scroll = Math.min(Math.max(-rect.top / Math.max(rect.height, 1), 0), 1);
            if (api.update) api.update(t, { x: mx, y: my }, scroll);
            renderer.render(scene, camera);
          }
          requestAnimationFrame(frame);
          container.classList.add("three-on");
        }).catch(function () { /* poster stays — nothing to do */ });
      });
    }
  };
})();
