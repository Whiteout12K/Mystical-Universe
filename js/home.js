// Birthdays

document.addEventListener("DOMContentLoaded",loadCharacterBirthdays);

async function loadCharacterBirthdays(){
  const section=document.getElementById("birthday-section");
  const list=document.getElementById("birthday-list");

  if(!section||!list)return;

  section.hidden=true;
  list.replaceChildren();

  try{
    const response=await fetch("/webpages/list-birthday.json",{
      cache:"no-cache"
    });

    if(!response.ok){
      throw new Error(`Birthday data returned ${response.status}.`);
    }

    const characters=await response.json();
    const today=new Date();
    const month=String(today.getMonth()+1).padStart(2,"0");
    const day=String(today.getDate()).padStart(2,"0");
    const todayKey=`${month}-${day}`;

    const birthdayCharacters=characters.filter(character=>
      character.birthday===todayKey
    );

    if(!birthdayCharacters.length)return;

    const dateText=today.toLocaleDateString(undefined,{
      month:"long",
      day:"numeric"
    });

    birthdayCharacters.forEach(character=>{
      const card=document.createElement("article");
      card.className="birthday-card";

      const content=document.createElement("div");
      content.className="birthday-content";

      const characterRow=document.createElement("div");
      characterRow.className="birthday-character";

      const avatar=document.createElement("img");
      avatar.className="birthday-avatar";
      avatar.src=character.avatar||character.splash||"";
      avatar.alt=`${character.name} avatar`;
      avatar.loading="lazy";

      const details=document.createElement("div");

      const name=document.createElement("h3");
      name.className="birthday-name";
      name.textContent=character.name;

      const date=document.createElement("p");
      date.className="birthday-date";
      date.textContent=dateText;

      details.append(name,date);
      characterRow.append(avatar,details);
      content.append(characterRow);
      card.append(content);
      list.append(card);
    });

    section.hidden=false;
  }catch(error){
    section.hidden=true;
    console.error("Unable to load character birthdays:",error);
  }
}