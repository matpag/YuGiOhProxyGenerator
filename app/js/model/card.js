const races={"Spellcaster": "spellcaster", "Dragon": "dragon", "Zombie": "zombie", "Warrior": "warrior", "Beast-Warrior": "beast_warrior", "Beast": "beast", "Winged Beast": "winged_beast", "Fiend": "fiend", "Fairy": "fairy", "Insect": "insect", "Dinosaur": "dinosaur", "Reptile": "reptile", "Fish": "fish", "Sea Serpent": "sea_serpent", "Aqua": "aqua", "Pyro": "pyro", "Thunder": "thunder", "Rock": "rock", "Plant": "plant", "Machine": "machine", "Psychic": "psychic", "Divine-Beast": "divine_beast", "Wyrm": "wyrm", "Cyberse": "cyberse", "Illusion": "illusion"};
const mechanics={Normal:'normal',Effect:'effect',Fusion:'fusion',Ritual:'ritual',Synchro:'synchro',Xyz:'xyz',XYZ:'xyz',Link:'link',Pendulum:'pendulum',Tuner:'tuner',Flip:'flip',Gemini:'gemini',Spirit:'spirit',Union:'union',Toon:'toon'};
const frames={normal:'Normal',effect:'Effect',fusion:'Fusion',ritual:'Ritual',synchro:'Synchro',xyz:'Xyz',link:'Link',spell:'Spell',trap:'Trap'};
export function normalizeCard(en,it=null) {
  if(!en?.id || !en.name) throw new Error('Dati canonici mancanti');
  if(it && it.id!==en.id) throw new Error('La coppia EN/IT contiene ID diversi');
  const family=en.type==='Spell Card'?'spell':en.type==='Trap Card'?'trap':'monster';
  const frame=en.frameType.replace(/_pendulum$/,'');
  if(!frames[frame]) throw new Error(`Frame non supportato: ${en.frameType}`);
  const typeline=en.typeline||[];
  const codes=typeline.slice(1).map(x=>mechanics[x]);
  if(codes.some(x=>!x)) throw new Error('Qualificatore carta non supportato');
  if(family==='monster'&&!races[en.race]) throw new Error(`Razza non supportata: ${en.race}`);
  const stat=x=>x===undefined?null:x===-1?'?':x;
  const text=c=>c?{name:c.name,description:c.desc,monsterEffect:c.monster_desc,pendulumEffect:c.pend_desc}:{};
  return {schemaVersion:1,passcode:String(en.id).padStart(8,'0'),family,frame,layout:frames[frame],race:family==='monster'?races[en.race]:en.race.toLowerCase(),icon:({'Normal':'None','Continuous':'Continuous','Quick-Play':'Quick-play','Field':'Field','Equip':'Equip','Ritual':'Ritual','Counter':'Counter'})[en.race]||'None',attribute:en.attribute?.toLowerCase()||family,mechanics:codes,
    level:frame==='xyz'||frame==='link'?null:en.level??null,rank:frame==='xyz'?en.level:null,linkValue:en.linkval??null,linkMarkers:en.linkmarkers||[],scale:en.scale??null,
    atk:stat(en.atk),def:stat(en.def),artworks:en.card_images||[],texts:{en:text(en),it:text(it)},source:{provider:'ygoprodeck',apiVersion:7}};
}
