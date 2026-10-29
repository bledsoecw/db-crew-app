// The DB Crew training videos: every word the crew hears, and every tap they
// see, in order — once in English and once in Spanish. The take's language is
// VIDEO_LANG (studio.mjs): the English take speaks and captions the English
// with the phone in English, the Spanish take speaks and captions `es` with
// the phone in Spanish. So `es` is not a subtitle of the English any more: it
// names the buttons by their Spanish words, the ones on the Spanish screen.
// A wording change is an edit here and a re-run of both takes.
//
// Five parts, one per role, each also cut as a video of its own (Carl's
// review, Oct 2026: short ones by role): every crew member (Zac, on the
// construction bench), site managers (Tyler), service, repair and warranty
// (Yahir), close out (Yahir), and reading the Production Board (the TV).
// Part 1 is the clock everyone uses; the others build on it.
//
// "The Ops Director", never Carl, in anything a crew member hears (Carl,
// 29 Oct 2026).
//
// Every action takes a function of { page, app, tv } (see studio.mjs), so the
// file can be walked with no browser to collect the narration first.
import fs from "node:fs";
import path from "node:path";
import { WORK, T } from "./studio.mjs";
import { showTv } from "./board-world.mjs";

// A target: a function of { page, app, tv } that also takes .first().
const target = (f) => Object.assign(f, { first: () => target((x) => f(x).first()) });
const $ = (sel, opts) => target((x) => x.app.locator(sel, opts));
const tab = (t) => $(`.tab[data-tab="${t}"]`);
const code = (name) => (x) => x.app.locator(".coderow", { hasText: name });
const photo = (name) => ({ name: `IMG_${name}.jpg`, mimeType: "image/jpeg", buffer: fs.readFileSync(path.join(WORK, "photos", `${name}.jpg`)) });
const tv = (sel, opts) => target((x) => x.tv.locator(sel, opts));
const bar = (num) => (x) => x.tv.locator(".tv-bar", { hasText: num }).first();

const ZAC = T("Signed in as <b>Zac Deitemeyer</b> · Crew", "Sesión de <b>Zac Deitemeyer</b> · Cuadrilla");
const TYLER = T("Signed in as <b>Tyler Mohr</b> · Site manager", "Sesión de <b>Tyler Mohr</b> · Encargado de obra");
const YAHIR = T("Signed in as <b>Yahir Gonzalez</b> · Service", "Sesión de <b>Yahir Gonzalez</b> · Servicio");
const TV = T("The war-room TV · <b>read only</b>", "La televisión de la sala de juntas · <b>solo lectura</b>");

/** The app's own variable, set the way a phone with notifications switched on has it. */
const notificationsOn = (s) => s.do(({ page }) => page.frames().find((f) => /index\.html/.test(f.url()))?.evaluate(() => { window.pushState = "on"; }));
/** The phone's clock, set for a part that starts a new day (the fixtures' Thursday). */
const at = (s, iso) => s.do(({ page }) => page.clock.setSystemTime(new Date(iso)));

export default async function script(s) {
  // ── 0 · Title ────────────────────────────────────────────────────────────
  await s.chapter(0, "DB Crew", {
    sub: "Five short videos, one for each job on the crew. Start with Part 1: the clock everyone uses.",
    subEs: "Cinco videos cortos, uno para cada trabajo en la cuadrilla. Empieza con la Parte 1: el reloj que usan todos.",
    es: "DB Crew",
  });
  await s.say(
    "Welcome to DB Crew, the company's app for the field. This training comes in five short parts: every crew member, site managers, service and repair work, close out, and reading the Production Board. Each part is also a video of its own.",
    { es: "Bienvenido a DB Crew, la aplicación de la empresa para el trabajo en campo. Esta capacitación tiene cinco partes cortas: toda la cuadrilla, los encargados de obra, el trabajo de servicio y reparación, el cierre de obra, y cómo leer el Production Board. Cada parte también es un video por separado." },
  );
  await s.say("Everyone starts with Part 1. Everything on screen is practice data, so none of these jobs are real customers.", {
    es: "Todos empiezan con la Parte 1. Todo lo que ves en pantalla son datos de práctica, así que ninguno de estos trabajos es de un cliente real.",
  });

  // ══ PART 1 · EVERY CREW MEMBER ════════════════════════════════════════════
  await s.part(1, "Every crew member", "The clock, from the shop to the job and back.", {
    title: "Toda la cuadrilla", sub: "El reloj, del taller al trabajo y de regreso.", say: "Parte 1. Toda la cuadrilla.",
  });
  await s.phone("crew");

  // ── 1 · Getting around ───────────────────────────────────────────────────
  await s.chapter(1, "Finding your way around", { who: ZAC, es: "Cómo moverte en la aplicación" });
  await s.uncard();
  await s.say("Open DB Crew on your phone and sign in with your company Google account. It stays signed in after that.", {
    es: "Abre DB Crew en tu teléfono y entra con tu cuenta de Google de la empresa. Después de eso se queda con la sesión abierta.",
  });
  await s.say("At the top are your name and your role. Zac is on the construction crew.", () => s.highlight($("#hdrW"), T("Your name and role", "Tu nombre y tu puesto")), {
    es: "Arriba están tu nombre y tu puesto. Zac está en la cuadrilla de construcción.",
  });
  await s.clear();
  await s.say("Along the bottom are your tabs: the Clock, and My jobs.", () => s.highlight($("#tabs"), T("Your tabs", "Tus pestañas")), {
    es: "Abajo están tus pestañas: «Reloj», y «Mis trabajos».",
  });
  await s.clear();
  await s.say("EN and ES switch the whole app between English and Spanish. The sun button switches the screen between dark, easiest to read outside, and light.", () => s.highlight([$("#clockLang"), $("#sunBtn")], T("Language · light or dark", "Idioma · claro u oscuro")), {
    es: "«EN» y «ES» cambian toda la aplicación entre inglés y español. El botón del sol cambia la pantalla entre oscura, que se lee mejor afuera, y clara.",
  });
  await s.clear();

  // ── 2 · Clocking in at the shop ──────────────────────────────────────────
  await s.chapter(2, "Clocking in at the shop", { who: ZAC, es: "Marcar entrada en el taller" });
  await s.uncard();
  await s.say("Today's job is at the top of the Clock. It comes from the Production Board: the job you're booked on today.", () => s.highlight($("#jobCard"), T("Today's job", "El trabajo de hoy")), {
    es: "El trabajo de hoy está arriba en el «Reloj». Viene del Production Board: el trabajo donde estás programado hoy.",
  });
  await s.clear();
  await s.say("The day starts at the shop on Monroe Street. When you get there, tap At the shop. That's it: one tap, no photo.", async () => {
    await s.highlight($("#shopBtn"), T("At the shop", "En el taller"));
    await s.wait(1800);
    await s.clear();
    await s.tap($("#shopBtn"), { after: 2200 });
  }, { es: "El día empieza en el taller de Monroe Street. Cuando llegas, toca «En el taller». Eso es todo: un toque, sin foto." });
  await s.say("You're on the clock, on the shop's Morning Clock-In. The timer runs, and the line under it says when you started.", () => s.highlight($("#band"), T("On the clock", "Marcado")), {
    es: "Ya estás marcado, en «Morning Clock-In» del taller. El reloj corre, y la línea de abajo dice a qué hora empezaste.",
  });
  await s.clear();
  await s.say("Your phone says where you clocked in from. If it isn't the shop or the office, the clock-in still counts, and your PM and the Ops Director are told.", {
    es: "Tu teléfono dice desde dónde marcaste. Si no es el taller ni la oficina, la entrada cuenta de todos modos, y se le avisa a tu PM y al Director de Operaciones.",
  });
  await s.say("Got there and forgot to clock in? Started earlier, under the timer, moves your start back. Pick how much earlier, then tap the button.", async () => {
    await s.tap($("#earlierBtn"), { after: 900 });
    await s.tap(target((x) => x.app.locator("#sheetBody [data-earlier]").first()), { after: 700 });
    await s.highlight($("#earlierGo"), T("Your block starts then", "Tu bloque empieza a esa hora"));
  }, { es: "¿Llegaste y se te olvidó marcar? «¿Empezaste antes? Di a qué hora», abajo del reloj, mueve tu entrada hacia atrás. Escoge cuánto antes, y toca el botón." });
  await s.clear();
  await s.say("Zac really did clock in on time, so he closes it. Changing your start tells your PM and the Ops Director, on the job.", () => s.tap($("#sheetClose"), { after: 800 }), {
    es: "Zac sí marcó a tiempo, así que lo cierra. Cambiar tu hora de entrada le avisa a tu PM y al Director de Operaciones, en el trabajo.",
  });

  // ── 3 · My jobs ──────────────────────────────────────────────────────────
  await s.chapter(3, "My jobs: where you're going", { who: ZAC, es: "Mis trabajos: a dónde vas" });
  await s.uncard();
  await s.say("My jobs shows where you're going, straight from the Production Board.", () => s.tap(tab("jobs"), { after: 900 }), {
    es: "«Mis trabajos» te muestra a dónde vas, directo del Production Board.",
  });
  await s.say("Across the top are the next two weeks. A dot means you're booked that day. Tap a day to jump to it.", () => s.highlight($("#weekStrip"), T("The next two weeks", "Las próximas dos semanas")), {
    es: "Arriba están las próximas dos semanas. Un punto quiere decir que estás programado ese día. Toca un día para ir a él.",
  });
  await s.clear();
  await s.say("Today's job is the green card. On a job that runs for weeks, it says the stage and the week: Rough-in, week two of three.", () => s.highlight($(".jcard.today .jwhen"), T("The stage and the week", "La etapa y la semana")), {
    es: "El trabajo de hoy es la tarjeta verde. En un trabajo que dura semanas, dice la etapa y la semana: «Obra negra», semana dos de tres.",
  });
  await s.clear();
  await s.say("Then the address, the customer and the town. The material line is the office's: how many lines of the order are in, and when the rest is due.", () => s.highlight([$(".jcard.today .jmain"), $(".jcard.today .jmat")], T("The job and its material", "El trabajo y su material")), {
    es: "Luego la dirección, el cliente y el pueblo. La línea del material es de la oficina: cuántas líneas del pedido ya llegaron, y cuándo llega lo demás.",
  });
  await s.clear();
  await s.say("From the office is the note the office wrote for this job. Directions opens your phone's maps with the address in it.", () => s.highlight([$(".jcard.today .jnote"), $(".jcard.today .jnav")], T("From the office · Directions", "De la oficina · Cómo llegar")), {
    es: "«De la oficina» es la nota que la oficina escribió para este trabajo. «Cómo llegar» abre los mapas de tu teléfono con la dirección puesta.",
  });
  await s.clear();
  await s.say("Under Next up are the jobs still to come. Halvorsen starts on Monday, and it has a Pre-start list.", () => s.highlight($('.jcard:has([data-prestart])'), T("Next up", "Lo que sigue")), {
    es: "En «Lo que sigue» están los trabajos que vienen. Halvorsen empieza el lunes, y tiene una lista de «Antes de empezar».",
  });
  await s.clear();
  await s.say("The pre-start is the bench's checklist before a job starts: the pre-con meeting, the permit, utilities marked, the first days' material, the dumpster, before photos, and the customer told.", async () => {
    await s.tap($("[data-prestart]"), { after: 1000 });
    await s.highlight($("#ckBody"), T("Before the bench starts", "Antes de que empiece la cuadrilla"));
  }, { es: "«Antes de empezar» es la lista de la cuadrilla antes de que empiece un trabajo: la junta previa, el permiso, los servicios marcados, el material de los primeros días, el contenedor, las fotos de antes, y avisarle al cliente." });
  await s.clear();
  await s.say("Two are done already. Zac called in the utility locate this morning, so he ticks that one.", () => s.tap($('[data-pline="utilities"]'), { after: 800 }), {
    es: "Dos ya están hechas. Zac pidió que marcaran los servicios hoy en la mañana, así que marca esa.",
  });
  await s.say("The ticks are saved when you leave the list, and the office sees them on the job in JobTread.", async () => {
    await s.highlight($("#ckState"), T("Saves when you leave", "Se guarda al salir"));
    await s.wait(1800);
    await s.clear();
    await s.tap($("#ckBack"), { after: 1200 });
  }, { es: "Las marcas se guardan cuando sales de la lista, y la oficina las ve en el trabajo en JobTread." });

  // ── 4 · Leaving the shop, and the drive ──────────────────────────────────
  await s.later(40 * 60_000);
  await s.chapter(4, "Leaving the shop, and the drive", { who: ZAC, es: "Salir del taller, y el viaje" });
  await s.tap(tab("job"), { after: 700 });
  await s.uncard();
  await s.say("The truck is loaded and it's time to go. Tap Leave the shop.", () => s.tap($("#leaveBtn"), { after: 1300 }), {
    es: "La camioneta está cargada y es hora de salir. Toca «Salir del taller».",
  });
  await s.say("Where are you going? Today's job from the board is on the list. Zac taps Lindqvist.", async () => {
    await s.highlight($("#sheetBody"), T("Where are you going?", "¿A dónde vas?"));
    await s.wait(1600);
    await s.clear();
    await s.tap($('[data-dest="v-8155"]'), { after: 2400 });
  }, { es: "¿A dónde vas? El trabajo de hoy del Production Board está en la lista. Zac toca Lindqvist." });
  await s.say("The clock is on the drive now, on that job's Travel Related Labor line. The drive is paid, and it takes no photo.", () => s.highlight($("#band"), T("On the drive", "En el viaje")), {
    es: "Ahora el reloj está en el viaje, en la línea «Travel Related Labor» de ese trabajo. El viaje se paga, y no lleva foto.",
  });
  await s.clear();
  await s.later(22 * 60_000);
  await s.say("At the job, tap I'm here, start work.", () => s.tap($("#arriveBtn"), { after: 1400 }), {
    es: "En el trabajo, toca «Ya llegué · empezar».",
  });
  await s.say("Pick what you're doing. The codes for a construction job come first. Every other code is below them.", () => s.highlight($("#sheetBody"), T("Construction codes first", "Primero los de construcción")), {
    es: "Escoge lo que vas a hacer. Los códigos de un trabajo de construcción van primero. Todos los demás códigos están abajo.",
  });
  await s.clear();
  await s.say("Zac is framing today, so he picks Framing and Sheeting. The first time you start work at a job each day, the camera asks for a start photo.", async () => {
    await s.tap(code("Framing/Sheeting"), { after: 1600 });
    await s.highlight($("#shutter"), T("The start photo", "La foto de inicio"));
  }, { es: "Hoy Zac está armando, así que escoge «Framing/Sheeting». La primera vez que empiezas a trabajar en un trabajo cada día, la cámara pide una foto de inicio." });
  await s.clear();
  await s.say("Take it, and you're on the clock at the job. It goes on the job in JobTread, tagged to your time.", () => s.tap($("#shutter"), { after: 3400 }), {
    es: "Tómala, y ya estás marcado en el trabajo. La foto queda en el trabajo en JobTread, ligada a tu tiempo.",
  });

  // ── 5 · Through the day ──────────────────────────────────────────────────
  await s.chapter(5, "Through the day", { who: ZAC, es: "Durante el día" });
  await s.uncard();
  await s.say("Four buttons cover the day: Break, Change code, Leave the site, and Clock out.", () => s.highlight($(".clkgrid"), T("Four buttons", "Cuatro botones")), {
    es: "Cuatro botones cubren el día: «Descanso», «Cambiar código», «Salir de la obra», y «Marcar salida».",
  });
  await s.clear();
  await s.say("Photos through the day go in DB Cam. DB Crew takes the start and end photos, and Take a photo is still here if you need it.", () => s.highlight([$("#photoBtn"), $("#photoNote")], T("Photos: DB Cam", "Fotos: DB Cam")), {
    es: "Las fotos durante el día van en DB Cam. DB Crew toma las fotos de inicio y de salida, y «Tomar una foto» sigue aquí si la necesitas.",
  });
  await s.clear();
  await s.later(2 * 3600_000 + 40 * 60_000);
  await s.say("The framing is up and Zac moves on to wiring. Change code, then the new code. No photo: you haven't left the job.", async () => {
    await s.tap($("#codeBtn"), { after: 1200 });
    await s.tap(code("Electrical"), { after: 1800 });
  }, { es: "Ya está armado y Zac sigue con la electricidad. «Cambiar código», y luego el código nuevo. Sin foto: no te has ido del trabajo." });
  await s.say("One step closes the old code and opens the new one, so you're never off the clock in between.", () => s.highlight($("#band"), T("On the new code", "En el código nuevo")), {
    es: "Un solo paso cierra el código viejo y abre el nuevo, así que nunca quedas fuera del reloj entre uno y otro.",
  });
  await s.clear();
  await notificationsOn(s);
  await s.say("Lunch. Tap Break, and pick how long. Each choice shows when the clock starts again.", async () => {
    await s.tap($("#breakBtn"), { after: 1000 });
    await s.highlight($(".brkgrid"), T("How long a break", "Cuánto descanso"));
  }, { es: "La comida. Toca «Descanso», y escoge cuánto tiempo. Cada opción dice a qué hora vuelve a empezar el reloj." });
  await s.clear();
  await s.say("Zac takes half an hour. The clock counts down to when you're back, and your phone reminds you five minutes before.", async () => {
    await s.tap($('[data-brk="30"]'), { after: 2400 });
    await s.highlight($("#band"), T("On a break", "En descanso"));
  }, { es: "Zac toma media hora. El reloj cuenta hacia atrás hasta que regresas, y tu teléfono te avisa cinco minutos antes." });
  await s.clear();
  await s.say("When the break is over, the clock starts again by itself, the way JobTread does it. End break brings your buttons back, and tapping it early starts the clock now.", async () => {
    await s.later(31 * 60_000);
    await s.wait(1200);
    await s.highlight($("#backBtn"), T("End break", "Terminar descanso"));
    await s.wait(1600);
    await s.clear();
    await s.tap($("#backBtn"), { after: 1600 });
  }, { es: "Cuando termina el descanso, el reloj vuelve a empezar solo, igual que en JobTread. «Terminar descanso» te regresa tus botones, y si lo tocas antes, el reloj empieza ya." });
  await s.later(60 * 60_000);
  await s.say("Short of wire, Zac runs to the supply house. Leave the site asks where you're going.", () => s.tap($("#leaveBtn"), { after: 1100 }), {
    es: "Le falta cable, así que Zac va por material. «Salir de la obra» pregunta a dónde vas.",
  });
  await s.say("A supply run, and back here after. Another job, and back later. Or another job, or the shop, and done here for today.", () => s.highlight($("#sheetBody"), T("Where to", "A dónde")), {
    es: "Ir por material y regresar aquí. Otro trabajo, y regresar más tarde. U otro trabajo, o el taller, y terminar aquí por hoy.",
  });
  await s.clear();
  await s.say("Zac taps Supply run. It goes on this job's travel line, with no photo.", () => s.tap($('[data-leave="supply"]'), { after: 2200 }), {
    es: "Zac toca «Ir por material». Va en la línea de viaje de este trabajo, sin foto.",
  });
  await s.later(35 * 60_000);
  await s.say("Back at the job, one tap puts him on the same code again.", async () => {
    await s.highlight($("#arriveBtn"), T("Back at the job", "De regreso en el trabajo"));
    await s.wait(1600);
    await s.clear();
    await s.tap($("#arriveBtn"), { after: 2200 });
  }, { es: "De regreso en el trabajo, un toque lo vuelve a poner en el mismo código." });

  // ── 6 · Clocking out ─────────────────────────────────────────────────────
  await s.later(2 * 3600_000);
  await s.chapter(6, "Clocking out", { who: ZAC, es: "Marcar salida" });
  await s.uncard();
  await s.say("Going back to the shop at the end of the day? Leave the site, then Back to the shop. The drive back is paid travel.", {
    es: "¿Regresas al taller al final del día? «Salir de la obra», y luego «Al taller». El viaje de regreso se paga como viaje.",
  });
  await s.say("Zac goes home from the job, so he taps Clock out. The camera asks for the end photo of the job.", async () => {
    await s.tap($("#outBtn"), { after: 1800 });
    await s.highlight($("#shutter"), T("The end photo", "La foto de salida"));
  }, { es: "Zac se va a su casa desde el trabajo, así que toca «Marcar salida». La cámara pide la foto de salida del trabajo." });
  await s.clear();
  await s.say("Already left before you clocked out? Don't take a picture of the road. Tap Already left, say when, and your time ends then, with no photo.", () => s.highlight($("#leftBtn"), T("Already left", "Ya saliste")), {
    es: "¿Ya te fuiste antes de marcar salida? No le tomes foto a la carretera. Toca «¿Ya saliste?», di a qué hora, y tu tiempo termina a esa hora, sin foto.",
  });
  await s.clear();
  await s.say("Zac is still at the job, so he takes the photo. That clocks him out.", () => s.tap($("#shutter"), { after: 3400 }), {
    es: "Zac todavía está en el trabajo, así que toma la foto. Eso marca su salida.",
  });
  await s.say("Forget to clock out? At seven in the evening your phone asks if you're still on the clock. Tap it, say when you left, and you're clocked out then.", {
    es: "¿Se te olvidó marcar salida? A las siete de la noche tu teléfono te pregunta si sigues marcado. Tócalo, di a qué hora te fuiste, y se marca tu salida a esa hora.",
  });

  // ── 7 · Your day ─────────────────────────────────────────────────────────
  await s.chapter(7, "Your day, crew member", {
    who: ZAC, es: "Tu día en la cuadrilla", day: true,
    sub: "1 · At the shop — one tap\n2 · Leave the shop — pick the job — the drive\n3 · I’m here — the job’s code — the start photo\n4 · Change code · Break · Leave the site\n5 · Clock out — the end photo",
    subEs: "1 · En el taller — un toque\n2 · Salir del taller — escoge el trabajo — el viaje\n3 · Ya llegué — el código del trabajo — la foto de inicio\n4 · Cambiar código · Descanso · Salir de la obra\n5 · Marcar salida — la foto de salida",
  });
  await s.say("So here's your day. At the shop, one tap. When the truck is loaded, Leave the shop, and pick the job.", {
    es: "Así es tu día. En el taller, un toque. Cuando la camioneta está cargada, «Salir del taller», y escoge el trabajo.",
  });
  await s.say("At the job: I'm here, the job's code, and the start photo. Through the day, Change code, Break, and Leave the site for a supply run.", {
    es: "En el trabajo: «Ya llegué», el código del trabajo, y la foto de inicio. Durante el día, «Cambiar código», «Descanso», y «Salir de la obra» para ir por material.",
  });
  await s.say("At the end of the day, drive back to the shop on the clock, or Clock out at the job with the end photo.", {
    es: "Al final del día, maneja de regreso al taller con el reloj corriendo, o «Marcar salida» en el trabajo con la foto de salida.",
  });

  // ══ PART 2 · SITE MANAGERS ════════════════════════════════════════════════
  await s.part(2, "Site managers", "The shop checks, the site checks, the sign-off and the day log.", {
    title: "Encargados de obra", sub: "Las revisiones del taller y de la obra, la firma y el registro del día.", say: "Parte 2. Encargados de obra.",
  });
  await at(s, "2026-08-06T10:58:00Z");
  await s.phone("siteManager");

  // ── 8 · Before you roll out ──────────────────────────────────────────────
  await s.chapter(8, "Before you roll out", { who: TYLER, es: "Antes de salir" });
  await s.uncard();
  await s.say("Site managers run the clock the same way as the crew, and three things more: the shop checks, the site checks, and the day log. Tyler is a site manager.", {
    es: "Los encargados de obra usan el reloj igual que la cuadrilla, y tres cosas más: las revisiones del taller, las revisiones de obra, y el registro del día. Tyler es encargado de obra.",
  });
  await s.say("He clocks in at the shop with one tap. When he taps Leave the shop, the app stops here first: Before you roll out.", async () => {
    await s.tap($("#shopBtn"), { after: 1800 });
    await s.later(45 * 60_000);
    await s.tap($("#leaveBtn"), { after: 1400 });
    await s.highlight($("#sheetBody"), T("Before you roll out", "Antes de salir"));
  }, { es: "Marca entrada en el taller con un toque. Cuando toca «Salir del taller», la aplicación primero se detiene aquí: «Antes de salir»." });
  await s.clear();
  await s.say("Each of today's roofs, with its shop checks: the tarps, and the dry-in supplies. When the material comes through the shop, Material loaded is on the list too.", () => s.highlight([$('[data-rline="tarps"]'), $('[data-rline="dryin"]')], T("The shop checks", "Las revisiones del taller")), {
    es: "Cada techo de hoy, con sus revisiones del taller: las lonas, y el material para cubrir. Cuando el material pasa por el taller, «Material cargado» también está en la lista.",
  });
  await s.clear();
  await s.say("Tyler checked both on the truck, so he ticks them. The drive waits until every line is ticked.", async () => {
    await s.tap($('[data-rline="tarps"]'), { after: 700 });
    await s.tap($('[data-rline="dryin"]'), { after: 900 });
  }, { es: "Tyler revisó las dos en la camioneta, así que las marca. El viaje espera hasta que todas las líneas estén marcadas." });
  await s.say("On a roof that takes more than a day, every morning asks again: the tarps, and today's material, with a box for anything the crew needs brought.", {
    es: "En un techo de más de un día, cada mañana vuelve a preguntar: las lonas, y el material de hoy, con un espacio para lo que la cuadrilla necesite.",
  });
  await s.say("Then All done, start the drive, and pick the roof.", async () => {
    await s.tap($("#rollGo"), { after: 1500 });
    await s.tap($('[data-dest="v-8127"]'), { after: 2400 });
  }, { es: "Luego «Todo listo · empezar el viaje», y escoge el techo." });
  await s.say("Forgot the shop checks? You can still clock in at the roof. The app asks for them first, and your PM and the Ops Director are told.", {
    es: "¿Se te olvidaron las revisiones del taller? Todavía puedes marcar entrada en el techo. La aplicación las pide primero, y se le avisa a tu PM y al Director de Operaciones.",
  });
  await s.later(28 * 60_000);
  await s.say("At the roof: I'm here, Project Management, and the start photo.", async () => {
    await s.tap($("#arriveBtn"), { after: 1400 });
    await s.tap(code("Project Management"), { after: 1600 });
    await s.tap($("#shutter"), { after: 3400 });
  }, { es: "En el techo: «Ya llegué», «Project Management», y la foto de inicio." });

  // ── 9 · The site checks ──────────────────────────────────────────────────
  await s.chapter(9, "The site checks", { who: TYLER, es: "Las revisiones de obra" });
  await s.tap(tab("jobs"), { after: 900 });
  await s.uncard();
  await s.say("The site checks replace the paper checklist. Every roofing job has them, on the job's card in My jobs.", () => s.highlight($('.jcard.today [data-checks]'), T("Site checks", "Revisiones de obra")), {
    es: "Las revisiones de obra reemplazan la lista de papel. Cada trabajo de techo las tiene, en la tarjeta del trabajo en «Mis trabajos».",
  });
  await s.clear();
  await s.tap($('.jcard.today [data-checks]'), { after: 900 });
  await s.say(
    "Five groups, in the order the job runs: at the shop, before the tear-off, while the roof is open, before you leave if you leave early, and before the crew leaves for good. The shop group is done already, from this morning.",
    () => s.highlight($("#ckBody"), T("Five groups", "Cinco grupos")),
    { es: "Cinco grupos, en el orden del trabajo: en el taller, antes de quitar el techo viejo, mientras el techo está abierto, antes de irte si te vas temprano, y antes de que la cuadrilla se vaya para siempre. El grupo del taller ya está hecho, desde la mañana." },
  );
  await s.clear();
  await s.say("Before the tear-off: right address, the homeowner talked to, and the scope matches the work order. Tap a line to tick it.", async () => {
    await s.tap($('.ckrow[data-line="address"]'), { after: 400 });
    await s.tap($('.ckrow[data-line="homeowner"]'), { after: 400 });
    await s.tap($('.ckrow[data-line="scope"]'), { after: 400 });
  }, { es: "Antes de quitar el techo viejo: la dirección correcta, ya hablaste con el dueño, y el trabajo coincide con la orden de trabajo. Toca una línea para marcarla." });
  await s.say("The pen at the end of a line puts a note on it. Tyler notes where the septic lid is.", async () => {
    await s.tap($('[data-note-add="septic"]'), { after: 600 });
    await s.do(({ page }) => page.keyboard.type(T("Septic lid by the back porch, keep the buggy off it", "La tapa de la fosa está junto al porche de atrás"), { delay: 30 }));
    await s.tap($('.ckrow[data-line="septic"]'), { after: 600 });
  }, { es: "El lápiz al final de una línea le pone una nota. Tyler anota dónde está la tapa de la fosa séptica." });
  await s.say("A line that doesn't fit this job: the pen, then Doesn't apply here, and say why. Ellen's association doesn't allow yard signs.", async () => {
    await s.tap($('[data-note-add="sign"]'), { after: 600 });
    await s.tap($('[data-na-open="sign"]'), { after: 600 });
    await s.do(({ page }) => page.keyboard.type(T("The HOA doesn't allow signs", "La asociación no permite letreros"), { delay: 30 }));
    await s.do(({ page }) => page.keyboard.press("Enter"));
    await s.wait(700);
  }, { es: "Una línea que no aplica en este trabajo: el lápiz, luego «No aplica aquí», y di por qué. La asociación de Ellen no permite letreros." });
  await s.say("It reads N, A, with the reason under it. It counts toward its group, but it's never green: nobody did it.", () => s.highlight($('.ckrow[data-line="sign"]'), T("Not applicable", "No aplica")), {
    es: "Dice «N/A», con la razón abajo. Cuenta para su grupo, pero nunca se pone verde: nadie lo hizo.",
  });
  await s.clear();
  await s.say("Leaving before the crew does? The PM approves it first, and Covered by is who takes the site over, and when you're back.", async () => {
    await s.tap($('[data-toggle="handover"]'), { after: 900 });
    await s.highlight($('[data-val="coveredBy"]'), T("Covered by", "Quién se queda"));
  }, { es: "¿Te vas antes que la cuadrilla? Primero lo aprueba el PM, y «Covered by» es quién se queda a cargo de la obra, y cuándo regresas." });
  await s.clear();
  await s.say("Every tick, note and reason goes into JobTread, on the job's roof install task, as one message for each save.", async () => {
    await s.tap($('[data-toggle="handover"]'), { after: 700 });
    await s.highlight($("#ckState"), T("Saved", "Guardado"));
  }, { es: "Cada marca, nota y razón entra a JobTread, en la tarea de instalación del techo, como un mensaje en cada guardado." });
  await s.clear();
  await s.say("Only a site manager can tick these. The rest of the crew can read them.", {
    es: "Solo un encargado de obra las puede marcar. El resto de la cuadrilla las puede leer.",
  });
  await s.say("The amber bar on the Clock is yesterday's job: Thornbury isn't signed off. Tap it to open that list.", async () => {
    await s.tap($("#ckBack"), { after: 700 });
    await s.tap(tab("job"), { after: 700 });
    await s.highlight($("#clockNudge"), T("Not signed off", "Sin firmar"));
    await s.wait(1500);
    await s.clear();
    await s.tap($("#clockNudge"), { after: 1000 });
  }, { es: "La barra ámbar en el «Reloj» es el trabajo de ayer: Thornbury no está firmado. Tócala para abrir esa lista." });
  await s.say("The last group has a few left. The magnet line asks who ran the magnet: tap your name, or type somebody else's.", async () => {
    await s.tap($('.ckrow[data-line="pickup"]'), { after: 400 });
    await s.tap($('.ckrow[data-line="corrections"]'), { after: 400 });
    await s.tap($("#ckWhoMe"), { after: 900 });
  }, { es: "Al último grupo le faltan unas. La línea del imán pregunta quién pasó el imán: toca tu nombre, o escribe el de otra persona." });
  await s.say("Watertight confirmed with is the crew leader who walked the roof with you. The app offers the one on this job.", () => s.tap($('[data-val-pick="watertightWith"]'), { after: 1000 }), {
    es: "«Watertight confirmed with» es el jefe de la cuadrilla que revisó el techo contigo. La aplicación te ofrece el de este trabajo.",
  });
  await s.say("Everything is ticked, so Tyler signs it off. His name and the date go on the job, and Unsign takes it back off if he needs to.", async () => {
    await s.tap($("#ckSignBtn"), { after: 900 });
    await s.tap($("#skYes"), { after: 1600 });
    await s.highlight($("#ckUnsign"), T("Unsign", "Quitar firma"));
  }, { es: "Todo está marcado, así que Tyler firma. Su nombre y la fecha quedan en el trabajo, y «Quitar firma» la quita si hace falta." });
  await s.clear();
  await s.say("On a roof that takes more than a day, the last group waits, folded, until the last day.", {
    es: "En un techo de más de un día, el último grupo espera, cerrado, hasta el último día.",
  });
  await s.tap($("#ckBack"), { after: 700 });

  // ── 10 · Leaving for the day: the day log ────────────────────────────────
  await s.chapter(10, "Leaving for the day: the day log", { who: TYLER, es: "Irte por hoy: el registro del día" });
  await s.tap(tab("job"), { after: 600 });
  await s.later(7 * 3600_000);
  await s.uncard();
  await s.say("A site manager sends the day log before leaving a site for the day. Tyler's crew goes home from the roof, so he taps Clock out, and the log opens first.", async () => {
    await s.tap($("#outBtn"), { after: 1600 });
    await s.highlight($("#dlBody .promptbox").first(), T("Send today's log first", "Primero el registro de hoy"));
  }, { es: "Un encargado de obra manda el registro del día antes de irse de la obra por hoy. La cuadrilla de Tyler se va a su casa desde el techo, así que toca «Marcar salida», y primero se abre el registro." });
  await s.clear();
  await s.say("How did today go? Tap Record and just say it, in English or Spanish. Tap Stop when you're done.", async () => {
    await s.tap($("#dlTalk"), { after: 500 });
    await s.hear(T("Tear-off and dry-in on the back slope are done. ABC boomed the shingles at seven thirty. Two sheets of decking replaced over the porch.",
      "Ya se quitó y se cubrió la parte de atrás. ABC subió las tejas a las siete y media. Se cambiaron dos hojas de madera arriba del porche."), { wordMs: 200 });
  }, { es: "¿Cómo te fue hoy? Toca «Grabar» y nada más dilo, en inglés o en español. Toca «Detener» cuando termines." });
  await s.tap($("#dlTalk"), { after: 900 });
  await s.say("Something the PM needs right now? Tell the PM now sends what's in the box to the PM this minute.", () => s.highlight($("#dlTellPm"), T("Tell the PM now", "Avisar al PM ahora")), {
    es: "¿Algo que el PM necesita ahora mismo? «Avisar al PM ahora» le manda al PM lo que está en la caja en este momento.",
  });
  await s.clear();
  await s.say("Then the questions. Any delays? Yes: weather. Anyone hurt, or a close call? A yes opens a safety alert that goes to the PM and the office the second you send it.", async () => {
    await s.tap($('[data-yn="f:22PC7jQ6BkBC"][data-v="1"]'), { after: 500 });
    await s.tap($('[data-opt="22PLhdEgfHXF"][data-val="Weather"]'), { after: 500 });
    await s.highlight($('[data-yn="safety"][data-v="1"]'), T("Anyone hurt?", "¿Alguien lastimado?"));
  }, { es: "Luego las preguntas. ¿Hubo retrasos? Sí: el clima. ¿Alguien se lastimó, o casi pasa un accidente? Un sí abre una alerta de seguridad que le llega al PM y a la oficina en el momento que la mandas." });
  await s.clear();
  await s.say("Nobody was hurt today, so No. Then Review and send, check it on one screen, and send today's log.", async () => {
    await s.tap($('[data-yn="safety"][data-v="0"]'), { after: 600 });
    await s.tap($('[data-yn="f:22PC7jNSGzEb"][data-v="1"]'), { after: 400 });
    await s.tap($('[data-opt="22PC7jNshbiK"][data-val="Roofing"]'), { after: 500 });
    await s.tap($("#dlReview"), { after: 1100 });
    await s.wait(1600);
    await s.tap($("#dlSend"), { after: 2000 });
  }, { es: "Hoy nadie se lastimó, así que «No». Luego «Revisar y enviar», revísalo en una sola pantalla, y manda el registro de hoy." });
  await s.say("The log goes into JobTread as the job's daily log, to the PM and the sales rep. Then the clock-out carries on by itself: the end photo.", () => s.tap($("#shutter"), { after: 3200 }), {
    es: "El registro entra a JobTread como el reporte diario del trabajo, para el PM y el vendedor. Luego la salida sigue sola: la foto de salida.",
  });
  await s.say("Leaving for another job, or back to the shop, done for the day works the same: the log first. On a quiet day, Normal day, nothing to report, sends it in one tap.", {
    es: "Irte a otro trabajo, o al taller, terminando por hoy, funciona igual: primero el registro. En un día tranquilo, «Día normal · nada que reportar» lo manda con un solo toque.",
  });

  // ── 11 · Your day ────────────────────────────────────────────────────────
  await s.chapter(11, "Your day, site manager", {
    who: TYLER, es: "Tu día como encargado de obra", day: true,
    sub: "1 · At the shop — then Leave the shop\n2 · Before you roll out — the shop checks\n3 · At the roof — I’m here, the code, the start photo\n4 · The site checks as the job runs — N/A with a reason\n5 · Leaving for the day — the day log, then the end photo",
    subEs: "1 · En el taller — luego Salir del taller\n2 · Antes de salir — las revisiones del taller\n3 · En el techo — Ya llegué, el código, la foto de inicio\n4 · Las revisiones de obra mientras avanza — N/A con su razón\n5 · Irte por hoy — el registro, luego la foto de salida",
  });
  await s.say("So here's a site manager's day. At the shop, one tap, and before the truck leaves, the shop checks.", {
    es: "Así es el día de un encargado de obra. En el taller, un toque, y antes de que salga la camioneta, las revisiones del taller.",
  });
  await s.say("At the roof: I'm here, your code, and the start photo. Tick the site checks as the job runs, with a reason for anything that doesn't apply.", {
    es: "En el techo: «Ya llegué», tu código, y la foto de inicio. Marca las revisiones de obra mientras avanza el trabajo, con una razón para lo que no aplique.",
  });
  await s.say("Before you leave a site for the day, send the day log. The end photo comes after it.", {
    es: "Antes de irte de una obra por hoy, manda el registro del día. La foto de salida va después.",
  });

  // ══ PART 3 · SERVICE, REPAIR & WARRANTY ═══════════════════════════════════
  await s.part(3, "Service, repair and warranty", "Your Close Out list, and a repair from start to finish.", {
    title: "Servicio, reparación y garantía", sub: "Tu lista de Close Out, y una reparación de principio a fin.", say: "Parte 3. Servicio, reparación y garantía.",
  });
  await at(s, "2026-08-06T11:12:00Z");
  await s.phone("service");

  // ── 12 · Your Close Out list ─────────────────────────────────────────────
  await s.chapter(12, "Your Close Out list", { who: YAHIR, es: "Tu lista de Close Out" });
  await s.uncard();
  await s.say("Service, repair and warranty work, and final inspections, live on the Close Out tab. The clock works the same as in Part 1.", () => s.highlight(tab("co"), "Close Out"), {
    es: "El trabajo de servicio, reparación y garantía, y las inspecciones finales, están en la pestaña «Close Out». El reloj funciona igual que en la Parte 1.",
  });
  await s.clear();
  await s.say("Assigned is your own work. All is every job waiting on close out.", () => s.highlight($("#coSeg"), T("Yours, or everybody's", "Lo tuyo, o de todos")), {
    es: "«Asignados» es tu trabajo. «Todos» son todos los trabajos que esperan cierre.",
  });
  await s.clear();
  await s.say("Yahir and Alberto work as a pair, so Yahir's phone has one more box. Ticked, Alberto's clock follows Yahir's all day.", async () => {
    await s.highlight($("[data-copartner]"), T("Alberto too", "Alberto también"));
    await s.wait(1600);
    await s.clear();
    await s.tap($("[data-copartner]"), { after: 1200 });
  }, { es: "Yahir y Alberto trabajan en pareja, así que el teléfono de Yahir tiene una casilla más. Marcada, el reloj de Alberto sigue al de Yahir todo el día." });
  await s.say("Each card has the job number in big type, the street, the customer and the town. The tag says what it is: a final inspection, or repairs and how many.", () => s.highlight($('.jcard:has([data-cojob="co-aber"])'), T("One job", "Un trabajo")), {
    es: "Cada tarjeta tiene el número de trabajo en grande, la calle, el cliente y el pueblo. La etiqueta dice qué es: una inspección final, o reparaciones y cuántas.",
  });
  await s.clear();

  // ── 13 · A repair, start to finish ───────────────────────────────────────
  await s.chapter(13, "A repair, start to finish", { who: YAHIR, es: "Una reparación, de principio a fin" });
  await s.uncard();
  await s.say("Today Yahir has a service call: two repairs at Castellano. His day starts at the shop: on the Clock tab, At the shop.", async () => {
    await s.tap(tab("job"), { after: 800 });
    await s.tap($("#shopBtn"), { after: 2000 });
  }, { es: "Hoy Yahir tiene una llamada de servicio: dos reparaciones en Castellano. Su día empieza en el taller: en la pestaña «Reloj», «En el taller»." });
  await s.later(35 * 60_000);
  await s.say("Time to go. Leave the shop, and pick Castellano from today's Close Out work. He's on the drive, on Castellano's travel line.", async () => {
    await s.tap($("#leaveBtn"), { after: 1300 });
    await s.tap($('[data-dest="co-cast"]'), { after: 2400 });
  }, { es: "Hora de salir. «Salir del taller», y escoge Castellano del trabajo de «Close Out» de hoy. Ya está en el viaje, en la línea de viaje de Castellano." });
  await s.later(22 * 60_000);
  await s.say("At Castellano, he goes back to Close Out. A repair card that's yours says Start. Start is the arrival: Service Repair Labor, and the start photo.", async () => {
    await s.tap(tab("co"), { after: 900 });
    await s.tap($('[data-costart="co-cast"]'), { after: 1800 });
    await s.tap($("#shutter"), { after: 3400 });
  }, { es: "En Castellano, regresa a «Close Out». Una tarjeta de reparación que es tuya dice «Empezar». «Empezar» es la llegada: «Service Repair Labor», y la foto de inicio." });
  await s.say("Repairs lists what the office asked for. Open the first one: what to do, who asked, and the day it's booked for.", async () => {
    await s.tap($('[data-coscreen="repairs"]'), { after: 900 });
    await s.tap($('[data-corepair="cs1"]'), { after: 900 });
    await s.highlight($("#coBody .rvcard").first(), T("What to do", "Qué hacer"));
  }, { es: "«Reparaciones» muestra lo que pidió la oficina. Abre la primera: qué hacer, quién lo pidió, y el día para el que está programada." });
  await s.clear();
  await s.say("Take a before photo of what you found. It's optional, but it shows the problem.", () => s.pick($('.phbig.empty[data-cophoto]').first(), [photo("bootOld")], { after: 1200 }), {
    es: "Toma una foto de antes de lo que encontraste. Es opcional, pero muestra el problema.",
  });
  await s.later(35 * 60_000);
  await s.say("Fix it, then the after photo. The after photo is required, and Done stays grey until it's in.", () => s.pick($('.phbig.empty[data-cophoto]').first(), [photo("bootNew")], { after: 1200 }), {
    es: "Arréglalo, y luego la foto de después. La foto de después es obligatoria, y «Terminado» se queda gris hasta que la tomes.",
  });
  await s.say("Tap Done.", () => s.tap($("#coDone"), { after: 1400 }), { es: "Toca «Terminado»." });
  await s.say("The last repair on the job says Finish and send to PM. Finishing it sends the job to the PM for review.", async () => {
    await s.tap($('[data-corepair="cs2"]'), { after: 900 });
    await s.pick($('.phbig.empty[data-cophoto]').first(), [photo("chimney")], { after: 900 });
    await s.later(25 * 60_000);
    await s.pick($('.phbig.empty[data-cophoto]').first(), [photo("chimney")], { after: 900 });
    await s.highlight($("#coDone"), T("The last repair", "La última reparación"));
  }, { es: "La última reparación del trabajo dice «Terminar y mandar al PM». Al terminarla, el trabajo pasa al PM para que lo revise." });
  await s.clear();
  await s.say("All repairs done, and nothing left for the crew on this job.", async () => {
    await s.tap($("#coDone"), { after: 1600 });
    await s.highlight($("#coBody .hero, #coBody > div").first(), T("Done", "Listo"));
  }, { es: "Todas las reparaciones terminadas, y no queda nada para la cuadrilla en este trabajo." });
  await s.clear();
  await s.say("A warranty call works exactly the same way. Sinclair, tomorrow, is a warranty repair.", async () => {
    await s.tap($("#coBack"), { after: 800 });
    await s.tap($("#coBack"), { after: 900 });
    await s.highlight($('.jcard:has([data-cojob="co-sinc"])'), T("Warranty", "Garantía"));
  }, { es: "Una llamada de garantía funciona exactamente igual. Sinclair, mañana, es una reparación de garantía." });
  await s.clear();

  // ── 14 · Your service day ────────────────────────────────────────────────
  await s.chapter(14, "Your day on service calls", {
    who: YAHIR, es: "Tu día en llamadas de servicio", day: true,
    sub: "1 · At the shop — one tap\n2 · Leave the shop — pick the call\n3 · Start on the repair card — the start photo\n4 · Before photo · the repair · after photo · Done\n5 · The last one: Finish & send to PM",
    subEs: "1 · En el taller — un toque\n2 · Salir del taller — escoge la llamada\n3 · Empezar en la tarjeta — la foto de inicio\n4 · Foto de antes · la reparación · foto de después · Terminado\n5 · La última: Terminar y mandar al PM",
  });
  await s.say("So here's a service day. At the shop, one tap. Leave the shop, and pick the call from today's Close Out work.", {
    es: "Así es un día de servicio. En el taller, un toque. «Salir del taller», y escoge la llamada del trabajo de «Close Out» de hoy.",
  });
  await s.say("When you get there, Start on the repair card. Before photo, the repair, the after photo, and Done. The last one is Finish and send to PM.", {
    es: "Cuando llegas, «Empezar» en la tarjeta de reparación. La foto de antes, la reparación, la foto de después, y «Terminado». La última es «Terminar y mandar al PM».",
  });

  // ══ PART 4 · CLOSE OUT ════════════════════════════════════════════════════
  await s.part(4, "Close out", "The final inspection, the cleanup, problems and the send.", {
    title: "Cierre de obra", sub: "La inspección final, la limpieza, los problemas y el envío.", say: "Parte 4. Cierre de obra.",
  });

  // ── 15 · Starting an inspection ──────────────────────────────────────────
  await s.later(30 * 60_000);
  await s.chapter(15, "Starting a final inspection", { who: YAHIR, es: "Empezar una inspección final" });
  await s.uncard();
  await s.say("Abernathy's final inspection is next, a drive from Castellano. On the Clock tab: Leave the site, then Another job, done here today. The end photo of Castellano starts the drive.", async () => {
    await s.tap(tab("job"), { after: 800 });
    await s.tap($("#leaveBtn"), { after: 1100 });
    await s.tap($('[data-leave="done-job"]'), { after: 1500 });
    await s.tap($("#shutter"), { after: 2600 });
  }, { es: "Sigue la inspección final de Abernathy, a un viaje de Castellano. En la pestaña «Reloj»: «Salir de la obra», y luego «Otro trabajo · terminé aquí por hoy». La foto de salida de Castellano empieza el viaje." });
  await s.say("Then Abernathy, from today's Close Out work.", () => s.tap($('[data-dest="co-aber"]'), { after: 2400 }), {
    es: "Luego Abernathy, del trabajo de «Close Out» de hoy.",
  });
  await s.later(15 * 60_000);
  await s.say("At Abernathy, Start on the card is the arrival. Pick Final Clean, and the start photo.", async () => {
    await s.tap(tab("co"), { after: 900 });
    await s.tap($('[data-costart="co-aber"]'), { after: 1600 });
    await s.tap(code("Final Clean"), { after: 1500 });
    await s.tap($("#shutter"), { after: 3400 });
  }, { es: "En Abernathy, «Empezar» en la tarjeta es la llegada. Escoge «Final Clean», y la foto de inicio." });
  await s.say("The job screen holds the whole visit: the inspection, the cleanup, any problems, visit photos, and the sold scope, what the customer bought.", () => s.highlight($("#coBody"), T("The whole visit", "Toda la visita")), {
    es: "La pantalla del trabajo tiene toda la visita: la inspección, la limpieza, los problemas, las fotos de la visita, y el trabajo vendido, lo que compró el cliente.",
  });
  await s.clear();

  // ── 16 · The inspection and cleanup ──────────────────────────────────────
  await s.chapter(16, "The inspection and the cleanup", { who: YAHIR, es: "La inspección y la limpieza" });
  await s.uncard();
  await s.say("The inspection is eight checks. Each one is OK, N/A, or Fix.", async () => {
    await s.tap($('[data-coscreen="inspect"]'), { after: 900 });
    await s.highlight($('.ans[data-key="22PdEQfPnVqh"]'), T("OK · N/A · Fix", "Bien · N/A · Falla"));
  }, { es: "La inspección son ocho revisiones. Cada una es «Bien», «N/A» o «Falla»." });
  await s.clear();
  await s.say("Shingles flat, drip edge secure, ridge caps seated: OK.", async () => {
    for (const k of ["22PdEQfPnVqh", "22PdEQfPnVqi", "22PdEQfPnVqj"]) await s.tap($(`.ans[data-key="${k}"] .ok`), { after: 250 });
  }, { es: "Tejas parejas, gotero firme, caballete completo: «Bien»." });
  await s.say("But a pipe boot on the back slope is cracked. Tap Fix, and it asks for a report: a photo, where it is, and a note.", async () => {
    await s.tap($('.ans[data-key="22PdEQfPnVqk"] .fix'), { after: 1100 });
    await s.pick($("#coBody [data-cophoto]").first(), [photo("bootOld")], { after: 1000 });
  }, { es: "Pero una bota del tubo en la parte de atrás está rota. Toca «Falla», y te pide un reporte: una foto, dónde está, y una nota." });
  await s.say("It's on the back. For the note, tap Record and say what's wrong. The office gets it in English.", async () => {
    await s.tap($('#coBody [data-cowhere="back"]'), { after: 500 });
    await s.tap($("#coBody .talkbtn").first(), { after: 500 });
    await s.hear(T("The pipe boot on the back slope is cracked and needs replacing.", "La bota del tubo de atrás está rota y hay que cambiarla."), { wordMs: 210 });
  }, { es: "Está en la parte de atrás. Para la nota, toca «Grabar» y di qué está mal. La oficina la recibe en inglés." });
  await s.tap($("#coBody .talkbtn").first(), { after: 900 });
  await s.say("Fixed it, if you fixed it there and then. Not fixed if somebody has to come back. Then Save report.", async () => {
    await s.highlight([$('[data-cofixed="1"]'), $('[data-cofixed="0"]')], T("Fixed, or not", "Arreglado, o no"));
    await s.wait(2400);
    await s.clear();
    await s.tap($("#coSaveReport"), { after: 1100 });
  }, { es: "«Lo arreglé», si lo arreglaste ahí mismo. «No, falta» si alguien tiene que regresar. Luego «Guardar reporte»." });
  await s.say("The rest pass. Next takes you to the five cleanup checks: the magnet sweep, materials and trash gone, gutters clean, no damage, and ready for the homeowner.", async () => {
    for (const k of ["22PdEQfPnVqm", "22PdEQfPnVqn", "22PdEQfPnVqp", "22PdEQfPnVqq"]) await s.tap($(`.ans[data-key="${k}"] .ok`), { after: 220 });
    await s.tap($("#coNext"), { after: 900 });
    for (const k of ["22PdEQhB6rSR", "22PdEQhB6rSS", "22PdEQhB6rST", "22PdEQhB6rSU", "22PdEQhB6rSV"]) await s.tap($(`.ans[data-key="${k}"] .ok`), { after: 260 });
  }, { es: "Las demás pasan. «Siguiente» te lleva a las cinco revisiones de limpieza: el imán, materiales y basura recogidos, canales limpios, sin daños, y listo para el dueño." });
  await s.say("Next again takes you back to the job.", () => s.tap($("#coNext"), { after: 900 }), {
    es: "«Siguiente» otra vez te regresa al trabajo.",
  });

  // ── 17 · Photos and the send ─────────────────────────────────────────────
  await s.chapter(17, "Photos, and sending it", { who: YAHIR, es: "Las fotos, y mandarlo" });
  await s.uncard();
  await s.say("Visit photos show how the job was left. They're optional, but they save a trip.", async () => {
    await s.tap($('[data-coscreen="photos"]'), { after: 900 });
    await s.pick($("#coBody [data-cophoto]").first(), [photo("slope")], { after: 900 });
    await s.pick($("#coBody [data-cophoto]").first(), [photo("house")], { after: 900 });
  }, { es: "Las fotos de la visita muestran cómo quedó el trabajo. Son opcionales, pero ahorran un viaje." });
  await s.say("Back on the job: Review and send. Check it, read what happens next, and tap Finish and send.", async () => {
    await s.tap($("#coBack"), { after: 800 });
    await s.tap($("#coReview"), { after: 1100 });
    await s.highlight($("#coBody .rvcard").first(), T("Check it", "Revísalo"));
    await s.wait(2000);
    await s.clear();
    await s.tap($("#coSend"), { after: 2600 });
  }, { es: "De vuelta en el trabajo: «Revisar y enviar». Revísalo, lee qué pasa después, y toca «Terminar y enviar»." });
  await s.say("Sent to JobTread, to Dave, the PM who reviews this roof. The problem you reported becomes a repair, and comes back to the crew the way you saw in Part 3.", () => s.highlight($("#coBody .hero, #coBody > div").first(), T("Sent", "Enviado")), {
    es: "Enviado a JobTread, a Dave, el PM que revisa este techo. El problema que reportaste se convierte en una reparación, y le regresa a la cuadrilla como viste en la Parte 3.",
  });
  await s.clear();
  await s.say("No signal? Everything is saved on the phone, and it sends itself as soon as there is signal.", {
    es: "¿No hay señal? Todo queda guardado en el teléfono, y se manda solo en cuanto haya señal.",
  });

  // ── 18 · Gutters and siding ──────────────────────────────────────────────
  await s.later(90 * 60_000);
  await s.chapter(18, "Gutters and siding", { who: YAHIR, es: "Canales y siding" });
  await s.uncard();
  await s.say("Some jobs have more than a roof. Fairbanks has a roof and gutters, and each one is inspected on its own.", async () => {
    await s.tap($("#coBackQueue"), { after: 900 });
    await s.tap($("#coBack"), { after: 900 });
    await s.tap($('.jmain[data-cojob="co-fair"]'), { after: 1100 });
    await s.highlight($("#coAreas"), T("Each area on its own", "Cada área por separado"));
  }, { es: "Algunos trabajos tienen más que un techo. Fairbanks tiene techo y canales, y cada uno se inspecciona por separado." });
  await s.clear();
  await s.say("Yahir drove here without leaving Abernathy on the Clock. Start on the gutters sees that, and asks what happened.", async () => {
    await s.tap($('[data-coarea="gutters"]'), { after: 1500 });
    await s.highlight($("#sheetBody"), T("Still on the clock", "Todavía marcado"));
  }, { es: "Yahir manejó hasta aquí sin salir de Abernathy en el «Reloj». «Empezar» en los canales se da cuenta, y pregunta qué pasó." });
  await s.clear();
  await s.say("He's already here, so he taps Already there, and says when he left Abernathy: half an hour ago.", async () => {
    await s.tap($('[data-move="left"]'), { after: 1100 });
    await s.tap(target((x) => x.app.locator("#sheetBody [data-leftat]").nth(2)), { after: 900 });
    await s.tap($("#leftGo"), { after: 1600 });
  }, { es: "Ya está aquí, así que toca «Ya estoy allá», y dice a qué hora se fue de Abernathy: hace media hora." });
  await s.say("Abernathy's time ends then, with no photo, and the half hour since is the drive. Your PM and the Ops Director are told on the job. Then Final Clean, and the start photo.", async () => {
    await s.tap(code("Final Clean"), { after: 1500 });
    await s.tap($("#shutter"), { after: 3400 });
  }, { es: "El tiempo de Abernathy termina a esa hora, sin foto, y la media hora desde entonces es el viaje. Se le avisa en el trabajo a tu PM y al Director de Operaciones. Luego «Final Clean», y la foto de inicio." });
  await s.say("Gutters and siding are photos and a note. Take at least one photo of how it was left, and say what you saw.", async () => {
    await s.pick($("#coBody [data-cophoto]").first(), [photo("gutter")], { after: 1000 });
    await s.tap($("#coBody .talkbtn").first(), { after: 500 });
    await s.hear(T("All runs are clean and the downspouts are reconnected.", "Todos los canales están limpios y las bajadas conectadas."), { wordMs: 200 });
    await s.tap($("#coBody .talkbtn").first(), { after: 700 });
  }, { es: "Los canales y el siding son fotos y una nota. Toma por lo menos una foto de cómo quedó, y di lo que viste." });
  await s.say("Then Finish and send. It goes to the PM who reviews gutters, and the board moves the job when every part of it is ready.", async () => {
    await s.tap($("#coAreaSend"), { after: 2600 });
    await s.highlight($("#coBody .hero, #coBody > div").first(), T("Sent", "Enviado"));
  }, { es: "Luego «Terminar y enviar». Le llega al PM que revisa los canales, y el tablero mueve el trabajo cuando todas sus partes están listas." });
  await s.clear();

  // ── 19 · Your close-out day ──────────────────────────────────────────────
  await s.chapter(19, "Your day on close out", {
    who: YAHIR, es: "Tu día en el cierre de obra", day: true,
    sub: "1 · Leave the site — the end photo — the drive\n2 · Start on the inspection card\n3 · Eight checks — Fix makes a report\n4 · Five cleanup checks · visit photos\n5 · Review & send — gutters and siding on their own",
    subEs: "1 · Salir de la obra — la foto de salida — el viaje\n2 · Empezar en la tarjeta de inspección\n3 · Ocho revisiones — Falla hace un reporte\n4 · Cinco de limpieza · fotos de la visita\n5 · Revisar y enviar — canales y siding por separado",
  });
  await s.say("So here's a close-out day. Leave the site for the job, and Start on the card when you get there.", {
    es: "Así es un día de cierre. «Salir de la obra» hacia el trabajo, y «Empezar» en la tarjeta cuando llegues.",
  });
  await s.say("Work the eight checks. Anything wrong is Fix, with a photo, where it is, and a note. Then the five cleanup checks, a few visit photos, and Review and send.", {
    es: "Haz las ocho revisiones. Lo que esté mal es «Falla», con una foto, dónde está, y una nota. Luego las cinco de limpieza, unas fotos de la visita, y «Revisar y enviar».",
  });
  await s.say("Gutters and siding are inspected on their own, with photos and a note. And if you drove off still on the clock somewhere else, don't take a photo of a place you've left: say when you left.", {
    es: "Los canales y el siding se inspeccionan por separado, con fotos y una nota. Y si te fuiste todavía marcado en otro lado, no le tomes foto a un lugar donde ya no estás: di a qué hora te fuiste.",
  });

  // ══ PART 5 · READING THE PRODUCTION BOARD ═════════════════════════════════
  await s.part(5, "Reading the Production Board", "The war-room TVs: who goes where, and what the tags mean.", {
    title: "Cómo leer el Production Board", sub: "Las televisiones de la sala de juntas: quién va a dónde, y qué quieren decir las etiquetas.", say: "Parte 5. Cómo leer el Production Board.",
  });
  await at(s, "2026-08-06T11:40:00Z");
  await s.setLayout("full");
  await s.do(({ page }) => showTv(page, "roofing"));

  // ── 20 · The war-room TV ─────────────────────────────────────────────────
  await s.chapter(20, "The war-room TV", { who: TV, es: "La televisión de la sala de juntas" });
  await s.uncard();
  await s.say("The Production Board is the office's schedule. In the war room, two TVs show it: this one has roofing, service and inspections, and the other has construction.", {
    es: "El Production Board es la programación de la oficina. En la sala de juntas, dos televisiones lo muestran: esta tiene techos, servicio e inspecciones, y la otra tiene construcción.",
  });
  await s.say("It's the same schedule your phone reads. If a job is on your row here, it's in My jobs too.", {
    es: "Es la misma programación que lee tu teléfono. Si un trabajo está en tu fila aquí, también está en «Mis trabajos».",
  });
  await s.say("Across the top are six working days. Yesterday comes first, so you can check what finished. Today is outlined.", () => s.highlight(tv(".tv-headcell", { hasText: "TODAY" }), T("Today", "Hoy")), {
    es: "Arriba hay seis días de trabajo. Ayer va primero, para que veas qué se terminó. Hoy está marcado.",
  });
  await s.clear();
  await s.say("Down the left is every crew. Find your name, and read across your row.", () => s.highlight(tv(".tv-crewname", { hasText: "Platinum Remodeling" }), T("Your crew", "Tu cuadrilla")), {
    es: "A la izquierda está cada cuadrilla. Busca tu nombre, y lee a lo largo de tu fila.",
  });
  await s.clear();
  await s.say("Each card is one job: the job number, the customer and the town, then the size of the roof in squares, and the site manager on the job.", () => s.highlight(bar("26-8127"), T("One job", "Un trabajo")), {
    es: "Cada tarjeta es un trabajo: el número de trabajo, el cliente y el pueblo, luego el tamaño del techo en cuadros, y el encargado de la obra.",
  });
  await s.clear();
  await s.say("A card that runs across two days is a two-day job.", () => s.highlight(bar("26-8133"), T("Two days", "Dos días")), {
    es: "Una tarjeta que cubre dos días es un trabajo de dos días.",
  });
  await s.clear();
  await s.say("The tag in the corner is the material. Ord means it's ordered, but no delivery day is set yet.", () => s.highlight(bar("26-8174"), "Ord"), {
    es: "La etiqueta en la esquina es el material. «Ord» quiere decir que está pedido, pero todavía no tiene día de entrega.",
  });
  await s.clear();
  await s.say("Drop means the delivery day is booked with the supplier.", () => s.highlight(bar("26-8140"), "Drop"), {
    es: "«Drop» quiere decir que el día de entrega ya está apartado con el proveedor.",
  });
  await s.clear();
  await s.say("Site, in green, means the site manager counted it on the job. Only that tick turns it green.", () => s.highlight(bar("26-8119"), "Site"), {
    es: "«Site», en verde, quiere decir que el encargado lo contó en el trabajo. Solo esa marca lo pone verde.",
  });
  await s.clear();
  await s.say("Short means only part of the order has gone in, and No PO means nothing has been ordered at all. Check with the office before you go on either one.", async () => {
    await s.highlight(bar("26-8159"), "Short");
    await s.wait(2200);
    await s.highlight(bar("26-8146"), "No PO");
  }, { es: "«Short» quiere decir que solo se pidió parte del material, y «No PO» quiere decir que no se ha pedido nada. Pregunta en la oficina antes de ir a cualquiera de los dos." });
  await s.clear();
  await s.say("The key along the bottom spells out every tag.", () => s.highlight(tv(".tv-legend"), T("The key", "La guía")), {
    es: "La guía de abajo explica cada etiqueta.",
  });
  await s.clear();
  await s.say("The band underneath is service, inspections and punch lists. A green card is a final inspection, and a purple one is a repair day.", async () => {
    await s.highlight(bar("26-8090"), T("Final inspection", "Inspección final"));
    await s.wait(2600);
    await s.highlight(tv(".tv-bar", { hasText: "26-8072" }).first(), T("Repair day", "Día de reparaciones"));
  }, { es: "La franja de abajo es servicio, inspecciones y listas de reparaciones. Una tarjeta verde es una inspección final, y una morada es un día de reparaciones." });
  await s.clear();
  await s.say("The week buttons show the week ahead, or the week before. The TV comes back to this week by itself after ten minutes.", async () => {
    await s.highlight(tv(".tv-weeknav"), T("Week back · week ahead", "Semana anterior · siguiente"));
    await s.wait(1600);
    await s.clear();
    await s.tap(tv(".tv-weekbtn", { hasText: "Week ahead" }), { after: 2200 });
    await s.tap(tv(".tv-weekbtn", { hasText: "This week" }), { after: 1600 });
  }, { es: "Los botones de semana muestran la semana siguiente, o la anterior. La televisión regresa sola a esta semana después de diez minutos." });
  await s.say("Nothing can be changed from the TV. If your card is wrong, or missing, tell the office. They fix it on the board, and the TV and your phone both follow.", {
    es: "Nada se puede cambiar desde la televisión. Si tu tarjeta está mal, o no aparece, avísale a la oficina. Ellos la arreglan en el tablero, y la televisión y tu teléfono se actualizan solos.",
  });

  // ── 21 · Wrap up ─────────────────────────────────────────────────────────
  await s.chapter(21, "That's DB Crew", { who: "", es: "Eso es DB Crew" });
  await s.say(
    "That's DB Crew: one app for the whole day. The clock, from the shop to the job and back. Your jobs and the TV, from the same schedule. And the checklists, the day log and Close Out, all going straight into JobTread.",
    { es: "Eso es DB Crew: una sola aplicación para todo el día. El reloj, del taller al trabajo y de regreso. Tus trabajos y la televisión, de la misma programación. Y las listas, el registro del día y «Close Out», todo directo a JobTread." },
  );
  await s.say("If something in the app looks wrong, tell the office. Thanks for watching.", {
    es: "Si algo en la aplicación se ve mal, avísale a la oficina. Gracias por ver.",
  });
}
