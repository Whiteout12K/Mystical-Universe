


document.addEventListener('contextmenu', function (e) {
    if (e.target.tagName === 'IMG') {
      e.preventDefault();
    }
});


document.addEventListener('DOMContentLoaded', () => {

  // Collect all data-img values
  const preloadImages = [];
  document.querySelectorAll('.char-thumb').forEach(thumb => {
    const img = thumb.getAttribute('data-img');
    if (img) preloadImages.push(img);
  });

  // Preload them
  preloadImages.forEach(src => {
    const img = new Image();
    img.src = src;
  });

});




// =========================================================
// Mystical Navbar Scroll Controller
// Static at top, appears fixed when scrolling up
// =========================================================

(()=>{
    "use strict";

    const NAV_SELECTOR=".mystical-navbar";
    const PLACEHOLDER_CLASS="navbar-scroll-placeholder";

    let navbar=null;
    let placeholder=null;
    let observer=null;
    let resizeObserver=null;

    let lastY=0;
    let ticking=false;
    let initialized=false;

    const threshold=4;

    function getScrollY(){
        return Math.max(
            window.scrollY||
            window.pageYOffset||
            document.documentElement.scrollTop||
            0,
            0
        );
    }

    function getNavbar(){
        return document.querySelector(NAV_SELECTOR);
    }

    function createPlaceholder(){
        if(!navbar)return;

        let existing=navbar.nextElementSibling;

        if(existing?.classList.contains(PLACEHOLDER_CLASS)){
            placeholder=existing;
            return;
        }

        placeholder=document.createElement("div");
        placeholder.className=PLACEHOLDER_CLASS;
        navbar.insertAdjacentElement("afterend",placeholder);
    }

    function updatePlaceholderHeight(){
        if(!navbar||!placeholder)return;

        const height=navbar.getBoundingClientRect().height;
        placeholder.style.height=`${height}px`;
    }

    function showAtTop(){
        if(!navbar||!placeholder)return;

        navbar.classList.add("navbar-at-top");
        navbar.classList.remove(
            "navbar-scroll-fixed",
            "navbar-scroll-hidden"
        );

        placeholder.classList.remove("active");
    }

    function showFixed(){
        if(!navbar||!placeholder)return;

        navbar.classList.remove(
            "navbar-at-top",
            "navbar-scroll-hidden"
        );

        navbar.classList.add("navbar-scroll-fixed");
        placeholder.classList.add("active");
    }

    function hideFixed(){
        if(!navbar||!placeholder)return;

        navbar.classList.remove("navbar-at-top");
        navbar.classList.add(
            "navbar-scroll-fixed",
            "navbar-scroll-hidden"
        );

        placeholder.classList.add("active");
    }

    function updateNavbar(force=false){
        if(!navbar||!navbar.isConnected){
            initialized=false;
            navbar=null;
            placeholder=null;
            return;
        }

        const y=getScrollY();
        const difference=y-lastY;
        const navbarHeight=navbar.getBoundingClientRect().height;

        updatePlaceholderHeight();

        /*
           At or very near the top:
           navbar remains part of normal document flow.
        */
        if(y<=Math.max(navbarHeight,5)){
            showAtTop();
            lastY=y;
            ticking=false;
            return;
        }

        /*
           During forced refreshes we only synchronize
           position instead of guessing a scroll direction.
        */
        if(force){
            if(
                navbar.classList.contains("navbar-scroll-fixed")&&
                !navbar.classList.contains("navbar-scroll-hidden")
            ){
                showFixed();
            }

            lastY=y;
            ticking=false;
            return;
        }

        /*
           Ignore tiny browser/mobile scroll fluctuations,
           but still update lastY so they don't accumulate.
        */
        if(Math.abs(difference)<threshold){
            lastY=y;
            ticking=false;
            return;
        }

        /*
           Scrolling upward:
           show navbar fixed at top.
        */
        if(difference<0){
            showFixed();
        }

        /*
           Scrolling downward:
           if the floating navbar exists, hide it upward.

           If the original navbar simply scrolled naturally
           out of view, there is nothing to display.
        */
        else{
            if(navbar.classList.contains("navbar-scroll-fixed")){
                hideFixed();
            }else{
                navbar.classList.remove("navbar-at-top");
                placeholder.classList.remove("active");
            }
        }

        lastY=y;
        ticking=false;
    }

    function requestUpdate(force=false){
        if(ticking&&!force)return;

        ticking=true;

        requestAnimationFrame(()=>{
            updateNavbar(force);
        });
    }

    function onScroll(){
        requestUpdate(false);
    }

    function onResize(){
        updatePlaceholderHeight();
        requestUpdate(true);
    }

    function onPageShow(){
        lastY=getScrollY();

        requestAnimationFrame(()=>{
            updatePlaceholderHeight();

            if(lastY<=navbar?.offsetHeight){
                showAtTop();
            }else{
                requestUpdate(true);
            }
        });
    }

    function watchNavbarSize(){
        if(!navbar)return;

        if(resizeObserver){
            resizeObserver.disconnect();
        }

        if("ResizeObserver" in window){
            resizeObserver=new ResizeObserver(()=>{
                updatePlaceholderHeight();
            });

            resizeObserver.observe(navbar);
        }
    }

    function initNavbar(){
        const found=getNavbar();

        if(!found)return false;

        /*
           If a dynamically loaded navbar replaced the old one,
           allow the new element to initialize.
        */
        if(initialized&&navbar===found&&navbar.isConnected){
            updatePlaceholderHeight();
            return true;
        }

        navbar=found;

        createPlaceholder();
        updatePlaceholderHeight();
        watchNavbarSize();

        lastY=getScrollY();

        if(lastY<=navbar.getBoundingClientRect().height){
            showAtTop();
        }else{
            /*
               Page may load already scrolled down,
               especially after refresh or browser back.
               Keep navbar hidden until user scrolls upward.
            */
            navbar.classList.remove(
                "navbar-at-top",
                "navbar-scroll-fixed",
                "navbar-scroll-hidden"
            );

            placeholder.classList.remove("active");
        }

        initialized=true;

        return true;
    }

    function watchForNavbar(){
        if(observer)return;

        observer=new MutationObserver(()=>{
            const found=getNavbar();

            /*
               Navbar was dynamically inserted.
            */
            if(found&&(!initialized||found!==navbar)){
                initNavbar();
            }

            /*
               Navbar was removed/replaced.
            */
            if(navbar&&!navbar.isConnected){
                initialized=false;
                navbar=null;
                placeholder=null;
            }
        });

        observer.observe(document.documentElement,{
            childList:true,
            subtree:true
        });
    }

    function start(){
        /*
           Try immediately.
           This works when this JS is loaded after the navbar.
        */
        initNavbar();

        /*
           Keep watching because include.js may insert the
           navbar after DOMContentLoaded.
        */
        watchForNavbar();

        window.addEventListener("scroll",onScroll,{
            passive:true
        });

        window.addEventListener("resize",onResize,{
            passive:true
        });

        window.addEventListener("orientationchange",()=>{
            setTimeout(onResize,100);
        });

        /*
           Important for browser back/forward navigation.
        */
        window.addEventListener("pageshow",()=>{
            if(!navbar||!navbar.isConnected){
                initNavbar();
            }

            onPageShow();
        });

        /*
           Bootstrap mobile navbar can alter its height.
        */
        document.addEventListener("shown.bs.collapse",e=>{
            if(navbar&&navbar.contains(e.target)){
                updatePlaceholderHeight();
            }
        });

        document.addEventListener("hidden.bs.collapse",e=>{
            if(navbar&&navbar.contains(e.target)){
                updatePlaceholderHeight();
            }
        });

        /*
           Some dynamic component loaders dispatch changes
           shortly after DOMContentLoaded. These retries are
           inexpensive and cover those cases even if mutation
           timing behaves unexpectedly.
        */
        [0,50,150,300,600,1000].forEach(delay=>{
            setTimeout(()=>{
                if(!navbar||!navbar.isConnected){
                    initNavbar();
                }
            },delay);
        });
    }

    /*
       Works whether this script loads before or after
       DOMContentLoaded.
    */
    if(document.readyState==="loading"){
        document.addEventListener("DOMContentLoaded",start,{
            once:true
        });
    }else{
        start();
    }
})();