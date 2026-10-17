async function loadComponent(id,file){
const target=document.getElementById(id);
if(!target)return;
try{
const response=await fetch(file);
if(!response.ok)throw new Error('Component unavailable');
target.innerHTML=await response.text();
if(id.includes('header')){setupMobileNavbar(target.querySelector('.mystical-navbar'));loadLoggedInUser();setupNavbarLogin();
for(const link of target.querySelectorAll('.nav-link[href]')){
if(new URL(link.href).pathname.replace(/\.html$/, '')===location.pathname.replace(/\.html$/, '')){link.classList.add('active');link.setAttribute('aria-current','page');}
}}
}catch(error){
console.error(`Unable to load ${file}:`,error);
const link=document.createElement('a');link.href='/';link.textContent='Mystical Legends home';target.replaceChildren(link);
const retry=document.createElement('button');retry.type='button';retry.textContent='Retry navigation';retry.onclick=()=>loadComponent(id,file);target.append(retry);
}
}

async function loadLoggedInUser(){
const loginUser=document.getElementById("loginUser"),loginMenu=document.getElementById("loginMenu"),userMenu=document.getElementById("userMenu"),profileImage=document.getElementById("profileImage"),usernameText=document.getElementById("usernameText"),mlGameProfile=document.getElementById("mlGameProfile");
if(!loginUser||!loginMenu||!userMenu)return;

const setLoggedOut=()=>{
loginMenu.style.display="";
userMenu.style.display="none";
if(profileImage)profileImage.style.display="none";
};

try{
const {loadAccountPreferences}=await import("/js/account-preferences.js");
const data=await loadAccountPreferences();
const user=data.user||data;

if(data.authenticated&&user.username){
if(usernameText)usernameText.textContent=user.username;

if(mlGameProfile){
mlGameProfile.href="/ml-game/apps/view.html?username="+encodeURIComponent(user.username);
}

loginMenu.style.display="none";
userMenu.style.display="";
if(profileImage){profileImage.src=data.appearance?.avatar_url||"/images/website/torch_full.png";profileImage.alt=user.username+" profile";profileImage.style.display="";}
setupLogout();
}else setLoggedOut();

}catch(error){
console.error("Unable to load logged in user:",error);
setLoggedOut();
}
}

function setupNavbarLogin(){
const form=document.getElementById("navbarLoginForm"),dropdown=document.getElementById("loginDropdown"),message=document.getElementById("navbarLoginMessage");
if(!form||!dropdown||!message)return;

form.addEventListener("submit",async event=>{
event.preventDefault();

const username=document.getElementById("navbarUsername")?.value.trim(),password=document.getElementById("navbarPassword")?.value;
message.textContent="";
message.classList.remove("show");

try{
const response=await fetch("/api/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username,password})});
const result=await response.json();

if(response.ok){window.location.reload();return;}

message.textContent=result.error||"Username or password is incorrect.";
message.classList.add("show");
bootstrap.Dropdown.getOrCreateInstance(dropdown).show();

}catch(error){
console.error("Login failed:",error);
message.textContent="Unable to connect to login service.";
message.classList.add("show");
bootstrap.Dropdown.getOrCreateInstance(dropdown).show();
}
});
}

function setupLogout(){
const logoutButton=document.getElementById("logoutButton");
if(!logoutButton||logoutButton.dataset.logoutReady)return;

logoutButton.dataset.logoutReady="true";

logoutButton.addEventListener("click",async()=>{
try{await fetch("/api/logout",{method:"POST"});}
catch(error){console.error("Logout failed:",error);}
window.location.reload();
});
}

function loadPageComponents(){
loadComponent("header-placeholder","/index/header.html");
loadComponent("footer-placeholder","/index/footer.html");
loadComponent("subheader-placeholder","/index/header.html");
loadComponent("subfooter-placeholder","/index/footer.html");
loadComponent("sub4header-placeholder","/index/header.html");
loadComponent("sub4footer-placeholder","/index/footer.html");

loadComponent("homeheader-placeholder","/index/header.html");
loadComponent("homefooter-placeholder","/index/footer.html");
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",loadPageComponents,{once:true});else loadPageComponents();

// Fit mobile dropdowns to the visible space, including the on-screen keyboard.
function setupMobileNavbar(navbar){
if(!navbar||navbar.dataset.mobileMenuReady)return;
navbar.dataset.mobileMenuReady='true';
const menu=navbar.querySelector('.navbar-collapse');
if(!menu)return;
const update=()=>{
if(!window.matchMedia('(max-width:991.98px)').matches){navbar.style.removeProperty('--mobile-menu-height');return;}
const viewport=window.visualViewport;
const bottom=viewport?viewport.offsetTop+viewport.height:window.innerHeight;
navbar.style.setProperty('--mobile-menu-height',Math.max(0,bottom-navbar.getBoundingClientRect().bottom-8)+'px');
};
window.addEventListener('resize',update,{passive:true});
window.visualViewport?.addEventListener('resize',update,{passive:true});
window.visualViewport?.addEventListener('scroll',update,{passive:true});
menu.addEventListener('show.bs.collapse',update);
menu.addEventListener('shown.bs.collapse',update);
menu.addEventListener('focusin',()=>requestAnimationFrame(update));
new ResizeObserver(update).observe(navbar);
update();
}

// Optional website improvements have independent switches in data/site-features.json.
if(!document.querySelector('script[data-ml-site-features]')){
 const enhancements=document.createElement('script');enhancements.type='module';enhancements.src='/js/site-enhancements/boot.js';enhancements.dataset.mlSiteFeatures='';document.head.append(enhancements);
}

if(!window.mlAccountHeaderListener){window.mlAccountHeaderListener=true;document.addEventListener('ml-account-change',()=>loadLoggedInUser());}
