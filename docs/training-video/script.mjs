// The DB Crew training video: every word the crew hears, its Spanish
// subtitle, and every tap they see, in order. The English here is the only
// copy of the narration — the voice reads it and the English captions are cut
// from it; `es` is the Spanish subtitle for the same line, sentence for
// sentence, so the two can be timed against the same pauses. A wording change
// is an edit here and a re-run.
//
// Buttons are named by their words on the screen, and the Spanish subtitles
// keep those words in English (in quotes) because the screens are filmed in
// English.
//
// Every action takes a function of { page, app, tv } (see studio.mjs), so the
// file can be walked with no browser to collect the narration first.
import fs from "node:fs";
import path from "node:path";
import { WORK } from "./studio.mjs";
import { showTv } from "./board-world.mjs";

// A target: a function of { page, app, tv } that also takes .first().
const target = (f) => Object.assign(f, { first: () => target((x) => f(x).first()) });
const $ = (sel, opts) => target((x) => x.app.locator(sel, opts));
const tab = (t) => $(`.tab[data-tab="${t}"]`);
const code = (name) => (x) => x.app.locator(".coderow", { hasText: name });
const photo = (name) => ({ name: `IMG_${name}.jpg`, mimeType: "image/jpeg", buffer: fs.readFileSync(path.join(WORK, "photos", `${name}.jpg`)) });
const tv = (sel, opts) => target((x) => x.tv.locator(sel, opts));
const bar = (num) => (x) => x.tv.locator(".tv-bar", { hasText: num }).first();

const TYLER = "Signed in as <b>Tyler Mohr</b> · Site manager";
const YAHIR = "Signed in as <b>Yahir Gonzalez</b> · Service";
const TV = "The war-room TV · <b>read only</b>";

/** The app's own variable, set the way a phone with notifications switched on has it. */
const notificationsOn = (s) => s.do(({ page }) => page.frames().find((f) => /index\.html/.test(f.url()))?.evaluate(() => { window.pushState = "on"; }));

export default async function script(s) {
  // ── 0 · Title ────────────────────────────────────────────────────────────
  await s.chapter(0, "DB Crew", {
    sub: "The clock, your jobs, the site checks, the day log and Close Out — and how to read the Production Board.",
    es: "DB Crew",
  });
  await s.say(
    "Welcome. This video shows you how to use DB Crew, the company's app for the field. It comes in four parts: production crews, service, repair and warranty work, close out, and reading the Production Board in the war room. The chapter marks let you jump straight to your part.",
    { es: "Bienvenido. Este video te enseña a usar DB Crew, la aplicación de la empresa para el trabajo en campo. Tiene cuatro partes: cuadrillas de producción, trabajos de servicio, reparación y garantía, el cierre de obra, y cómo leer el Production Board en la sala de juntas. Las marcas de capítulo te llevan directo a tu parte." },
  );
  await s.say("Everything on screen is practice data, so none of these jobs are real customers.", {
    es: "Todo lo que ves en pantalla son datos de práctica, así que ninguno de estos trabajos es de un cliente real.",
  });

  // ══ PART 1 · PRODUCTION CREWS ═════════════════════════════════════════════
  await s.part(1, "Production crews", "The clock, My jobs, the site checks and the day log.", { say: "Parte 1. Cuadrillas de producción." });
  await s.phone("siteManager");

  // ── 1 · Getting around ───────────────────────────────────────────────────
  await s.chapter(1, "Finding your way around", { who: TYLER, es: "Cómo moverte en la aplicación" });
  await s.uncard();
  await s.say("Open DB Crew on your phone and sign in with your company Google account. The phone stays signed in after that.", {
    es: "Abre DB Crew en tu teléfono y entra con tu cuenta de Google de la empresa. Después de eso el teléfono se queda con la sesión abierta.",
  });
  await s.say("At the top are your name and your role. Tyler is a site manager.", () => s.highlight($("#hdrW"), "Your name and role"), {
    es: "Arriba están tu nombre y tu puesto. Tyler es supervisor de obra.",
  });
  await s.clear();
  await s.say(
    "Along the bottom are your tabs. Everyone has Clock and My jobs. Site managers also have the Day log. The service and close-out crew have Clock and Close Out instead.",
    () => s.highlight($("#tabs"), "Your tabs"),
    { es: "Abajo están tus pestañas. Todos tienen «Clock» y «My jobs». Los supervisores de obra también tienen «Day log». La cuadrilla de servicio y cierre tiene «Clock» y «Close Out»." },
  );
  await s.clear();
  await s.say("The sun button switches the screen between dark, which is easiest to read outside, and light.", () => s.highlight($("#sunBtn"), "Light or dark"), {
    es: "El botón del sol cambia la pantalla entre oscura, que se lee mejor afuera, y clara.",
  });
  await s.clear();
  await s.say("An amber bar across the top is something you still owe. Here, yesterday's roof was never signed off. We'll come back to it.", () => s.highlight($("#clockNudge"), "Something you owe"), {
    es: "Una barra ámbar arriba es algo que todavía debes. Aquí, el techo de ayer nunca se firmó. Volveremos a eso.",
  });
  await s.clear();

  // ── 2 · Clocking in ──────────────────────────────────────────────────────
  await s.chapter(2, "Clocking in", { who: TYLER, es: "Marcar entrada" });
  await s.uncard();
  await s.say("Today's job is at the top of the Clock. The app picks it from the Production Board: the job you're booked on today.", () => s.highlight($("#jobCard"), "Today's job"), {
    es: "El trabajo de hoy está arriba en «Clock». La aplicación lo toma del Production Board: el trabajo donde estás programado hoy.",
  });
  await s.clear();
  await s.say("If it's the wrong job, Change job lets you pick the right one.", () => s.highlight($("#pickJobBtn"), "Change job"), {
    es: "Si no es el trabajo correcto, «Change job» te deja escoger el correcto.",
  });
  await s.clear();
  await s.say("To start your day, tap Clock in.", () => s.tap($("#clockIn")), { es: "Para empezar tu día, toca «Clock in»." });
  await s.say("Pick what you're doing. These are the job's own labor codes from JobTread.", () => s.highlight([code("Project Management"), code("Service Repair Labor")], "The job's codes"), {
    es: "Escoge lo que vas a hacer. Estos son los códigos de mano de obra del trabajo, de JobTread.",
  });
  await s.clear();
  await s.say("Tyler is running the job, so he picks Project Management.", () => s.tap(code("Project Management"), { after: 1600 }), {
    es: "Tyler dirige la obra, así que escoge «Project Management».",
  });
  await s.say("The camera opens on the start photo. Take a picture of the job. The shutter is what clocks you in.", () => s.highlight($("#shutter"), "The shutter clocks you in"), {
    es: "La cámara se abre en la foto de inicio. Toma una foto del trabajo. El botón de la cámara es lo que marca tu entrada.",
  });
  await s.clear();
  await s.say("There's no clocking in without the photo. It goes on the job in JobTread, tagged to your time.", () => s.tap($("#shutter"), { after: 3600 }), {
    es: "No se puede marcar entrada sin la foto. La foto queda en el trabajo en JobTread, ligada a tu tiempo.",
  });
  await s.say("You're on the clock. The timer runs, and the line underneath says when you started and that the start photo is in.", () => s.highlight($("#band"), "On the clock"), {
    es: "Ya estás marcado. El reloj corre, y la línea de abajo dice a qué hora empezaste y que la foto de inicio ya está.",
  });
  await s.clear();

  // ── 3 · My jobs ──────────────────────────────────────────────────────────
  await s.chapter(3, "My jobs: where you're going", { who: TYLER, es: "My jobs: a dónde vas" });
  await s.uncard();
  await s.say("My jobs shows where you're going. It comes straight from the Production Board.", () => s.tap(tab("jobs"), { after: 900 }), {
    es: "«My jobs» te muestra a dónde vas. Viene directo del Production Board.",
  });
  await s.say("Across the top are the next two weeks. A dot means you're booked that day. Tap a day to jump to it.", () => s.highlight($("#weekStrip"), "The next two weeks"), {
    es: "Arriba están las próximas dos semanas. Un punto quiere decir que estás programado ese día. Toca un día para ir a él.",
  });
  await s.clear();
  await s.say("Today's job is the green card. It says which day of the job this is, the address, the customer and the town, and who you're with.", () => s.highlight([$(".jcard.today .jwhen"), $(".jcard.today .jmain")], "Today"), {
    es: "El trabajo de hoy es la tarjeta verde. Dice qué día del trabajo es, la dirección, el cliente y el pueblo, y con quién vas.",
  });
  await s.clear();
  await s.say("The material line says where the material is. Amber means it's ordered or due, but nobody has seen it on site yet. It only turns green when the site manager counts it on the job.", () => s.highlight($(".jcard.today .jmat"), "The material"), {
    es: "La línea de material dice dónde está el material. Ámbar quiere decir que está pedido o por llegar, pero nadie lo ha visto en la obra. Solo se pone verde cuando el supervisor lo cuenta en el trabajo.",
  });
  await s.clear();
  await s.say("From the office is the note the office wrote for this job: gate codes, dogs, where the material goes.", () => s.highlight($(".jcard.today .jnote"), "From the office"), {
    es: "«From the office» es la nota que la oficina escribió para este trabajo: códigos del portón, perros, dónde va el material.",
  });
  await s.clear();
  await s.say("Directions opens your phone's maps with the address already in it.", () => s.highlight($(".jcard.today .jnav"), "Directions"), {
    es: "«Directions» abre los mapas de tu teléfono con la dirección ya puesta.",
  });
  await s.clear();
  await s.say("Under Next up are the jobs still to come. Go here instead moves your clock to that job, if the plan changes in the morning.", async () => {
    await s.highlight($('.jcard:has([data-go="v-8140"])'), "Next up");
    await s.wait(2600);
    await s.clear();
    await s.highlight($('[data-go="v-8140"]'), "Go here instead");
  }, { es: "En «Next up» están los trabajos que vienen. «Go here instead» pasa tu reloj a ese trabajo, si el plan cambia en la mañana." });
  await s.clear();
  await s.say("If the board can't be reached, My jobs says so, and shows the jobs you've clocked into lately. The clock never waits on the board.", {
    es: "Si no se puede llegar al Production Board, «My jobs» te lo dice y te muestra los trabajos donde marcaste últimamente. El reloj nunca espera al Production Board.",
  });

  // ── 4 · Site checks ──────────────────────────────────────────────────────
  await s.chapter(4, "Site checks, for site managers", { who: TYLER, es: "La lista de la obra, para supervisores" });
  await s.uncard();
  await s.say("Site managers: the site checks replace the paper checklist in the packet. Every roofing job has them.", () => s.highlight($('.jcard.today [data-checks]'), "Site checks"), {
    es: "Supervisores de obra: la lista de la obra reemplaza la lista de papel del paquete. Cada trabajo de techo la tiene.",
  });
  await s.clear();
  await s.tap($('.jcard.today [data-checks]'), { after: 900 });
  await s.say(
    "There are five groups, in the order the job runs: at the yard, before the tear-off, while the roof is open, before you leave if you leave early, and before the crew leaves for good.",
    () => s.highlight($("#ckBody"), "Five groups"),
    { es: "Hay cinco grupos, en el orden del trabajo: en el patio, antes de quitar el techo viejo, mientras el techo está abierto, antes de irte si te vas temprano, y antes de que la cuadrilla se vaya para siempre." },
  );
  await s.clear();
  await s.say("At the yard, before you roll out: the tarps and the dry-in supplies. Tap a line to tick it.", async () => {
    await s.tap($('.ckrow[data-line="tarps"]'), { after: 500 });
    await s.tap($('.ckrow[data-line="dryin"]'), { after: 500 });
  }, { es: "En el patio, antes de salir: las lonas y el material para cubrir el techo. Toca una línea para marcarla." });
  await s.say("It saves by itself, and the top of the screen says Saved. The next group opens on its own.", () => s.highlight($("#ckState"), "Saved"), {
    es: "Se guarda solo, y arriba de la pantalla dice «Saved». El siguiente grupo se abre solo.",
  });
  await s.clear();
  await s.say("Before the tear-off: right address, the homeowner talked to, and the scope on site matches the work order.", async () => {
    await s.tap($('.ckrow[data-line="address"]'), { after: 400 });
    await s.tap($('.ckrow[data-line="homeowner"]'), { after: 400 });
    await s.tap($('.ckrow[data-line="scope"]'), { after: 400 });
  }, { es: "Antes de quitar el techo viejo: la dirección correcta, ya hablaste con el dueño, y el trabajo en la obra coincide con la orden de trabajo." });
  await s.say("Got something to add? The pen at the end of a line puts a note on it.", () => s.tap($('[data-note-add="septic"]'), { after: 600 }), {
    es: "¿Tienes algo que agregar? El lápiz al final de una línea le pone una nota.",
  });
  await s.say("Tyler notes where the septic lid is.", async () => {
    await s.do(({ page }) => page.keyboard.type("Septic lid by the back porch, keep the buggy off it", { delay: 32 }));
    await s.tap($('.ckrow[data-line="septic"]'), { after: 600 });
  }, { es: "Tyler anota dónde está la tapa de la fosa séptica." });
  await s.say("Every tick and every note goes into JobTread, on the job's roof install task, where the office sees it.", {
    es: "Cada marca y cada nota entra a JobTread, en la tarea de instalación del techo, donde la oficina la ve.",
  });
  await s.say("Only a site manager can tick these. Everyone else on the crew can read them.", {
    es: "Solo un supervisor de obra puede marcarlas. Todos los demás de la cuadrilla las pueden leer.",
  });
  await s.say("Now that amber bar: yesterday's roof isn't signed off. Tap it, and it opens that job's list.", async () => {
    await s.tap($("#ckBack"), { after: 700 });
    await s.tap(tab("job"), { after: 700 });
    await s.tap($("#clockNudge"), { after: 1000 });
  }, { es: "Ahora la barra ámbar: el techo de ayer no está firmado. Tócala, y abre la lista de ese trabajo." });
  await s.say("Two lines are left in the last group. Tick them.", async () => {
    await s.tap($('.ckrow[data-line="pickup"]'), { after: 400 });
    await s.tap($('.ckrow[data-line="corrections"]'), { after: 400 });
  }, { es: "Quedan dos líneas en el último grupo. Márcalas." });
  await s.say("The magnet line asks who ran the magnet. Tap your name, or type somebody else's.", () => s.tap($("#ckWhoMe"), { after: 900 }), {
    es: "La línea del imán pregunta quién pasó el imán. Toca tu nombre, o escribe el de otra persona.",
  });
  await s.say("With everything ticked, tap Sign off as Tyler, then Yes.", async () => {
    await s.tap($("#ckSignBtn"), { after: 900 });
    await s.tap($("#skYes"), { after: 1500 });
  }, { es: "Con todo marcado, toca «Sign off as Tyler», y luego «Yes»." });
  await s.say("Your name and the date go on the job. The ticks stay editable, and Unsign takes the signature back off if you need to.", () => s.highlight($("#ckUnsign"), "Unsign"), {
    es: "Tu nombre y la fecha quedan en el trabajo. Las marcas se pueden cambiar, y «Unsign» quita la firma si hace falta.",
  });
  await s.clear();
  await s.tap($("#ckBack"), { after: 700 });

  // ── 5 · Photos, breaks and switching ─────────────────────────────────────
  await s.chapter(5, "Photos, breaks and switching codes", { who: TYLER, es: "Fotos, descansos y cambio de código" });
  await s.tap(tab("job"), { after: 600 });
  await s.uncard();
  await s.say("Back on the Clock. Take a photo opens the camera for a progress shot.", () => s.tap($("#photoBtn"), { after: 1500 }), {
    es: "De vuelta en «Clock». «Take a photo» abre la cámara para una foto del avance.",
  });
  await s.say("It lands on the job, tagged to the code you're on. From my photos sends a picture you already took with the phone's own camera.", () => s.highlight($("#galBtn"), "From my photos"), {
    es: "La foto queda en el trabajo, ligada al código donde estás. «From my photos» manda una foto que ya tomaste con la cámara del teléfono.",
  });
  await s.clear();
  await s.tap($("#shutter"), { after: 2400 });
  await s.later(3 * 3600_000 + 2 * 60_000);
  await notificationsOn(s);
  await s.say("A few hours later, it's time for a break. Tap Stop the clock.", () => s.tap($("#stopBtn"), { after: 600 }), {
    es: "Unas horas después, es hora de descansar. Toca «Stop the clock».",
  });
  await s.say("It gives you three choices: a break, switching code or job, or clocking out for the day.", () => s.highlight($("#sheetBody"), "Three choices"), {
    es: "Te da tres opciones: un descanso, cambiar de código o de trabajo, o marcar salida del día.",
  });
  await s.clear();
  await s.say("Tap Break, and pick how long: fifteen minutes, half an hour, forty-five minutes or an hour. Each one shows when the clock starts again.", async () => {
    await s.tap($("#stopBreak"), { after: 900 });
    await s.highlight($(".brkgrid"), "How long a break");
  }, { es: "Toca «Break», y escoge cuánto tiempo: quince minutos, media hora, cuarenta y cinco minutos o una hora. Cada uno dice a qué hora vuelve a empezar el reloj." });
  await s.clear();
  await s.say("Tyler takes half an hour.", () => s.tap($('[data-brk="30"]'), { after: 2600 }), { es: "Tyler toma media hora." });
  await s.say("On a break, the clock counts down to when you're back. Your hours so far are already saved.", () => s.highlight($("#band"), "On a break"), {
    es: "En el descanso, el reloj cuenta hacia atrás hasta que regresas. Tus horas hasta ahora ya están guardadas.",
  });
  await s.clear();
  await s.say("Your phone reminds you five minutes before the break ends, and again when it's over.", () => s.highlight($("#breakFoot"), "Two reminders"), {
    es: "Tu teléfono te avisa cinco minutos antes de que termine el descanso, y otra vez cuando se acaba.",
  });
  await s.clear();
  await s.say("The clock starts again by itself when the break is over, the same way JobTread does it. Back early? Tap End break and it starts now.", async () => {
    await s.later(31 * 60_000);
    await s.wait(1200);
    await s.highlight($("#backBtn"), "End break");
  }, { es: "El reloj vuelve a empezar solo cuando termina el descanso, igual que en JobTread. ¿Regresaste antes? Toca «End break» y empieza ahora." });
  await s.clear();
  await s.tap($("#backBtn"), { after: 2400 });
  await s.later(3 * 3600_000);
  await s.say("The shingles are on and the crew is cleaning up, so Tyler switches to the clean-up code. Stop the clock, then Switch code or job.", async () => {
    await s.tap($("#stopBtn"), { after: 600 });
    await s.tap($("#stopSwitch"), { after: 1500 });
  }, { es: "Las tejas ya están puestas y la cuadrilla está limpiando, así que Tyler cambia al código de limpieza. «Stop the clock», y luego «Switch code or job»." });
  await s.say("First an end photo of what you're leaving.", () => s.tap($("#shutter"), { after: 3000 }), { es: "Primero una foto final de lo que dejas." });
  await s.say("Then the new code, and its start photo.", async () => {
    await s.tap(code("Site Prep/Clean Up"), { after: 1600 });
    await s.tap($("#shutter"), { after: 3200 });
  }, { es: "Luego el código nuevo, y su foto de inicio." });
  await s.say("One step closes the old code and opens the new one, so you're never off the clock in between.", () => s.highlight($("#band"), "On the new code"), {
    es: "Un solo paso cierra el código viejo y abre el nuevo, así que nunca quedas fuera del reloj entre uno y otro.",
  });
  await s.clear();
  await s.say("Going to another roof is Move to another job, at the top. It's the same end photo, then the other job's code and its start photo.", () => s.highlight($("#pickJobBtn"), "Move to another job"), {
    es: "Para ir a otro techo usa «Move to another job», arriba. Es la misma foto final, y luego el código del otro trabajo y su foto de inicio.",
  });
  await s.clear();

  // ── 6 · Clocking out and the day log ─────────────────────────────────────
  await s.chapter(6, "Clocking out and the day log", { who: TYLER, es: "Marcar salida y el reporte del día" });
  await s.later(2 * 3600_000);
  await s.uncard();
  await s.say("At the end of the day, Stop the clock, then Clock out for the day.", async () => {
    await s.tap($("#stopBtn"), { after: 600 });
    await s.tap($("#stopOut"), { after: 1500 });
  }, { es: "Al final del día, «Stop the clock», y luego «Clock out for the day»." });
  await s.say("Take the end photo. That clocks you out.", () => s.tap($("#shutter"), { after: 3200 }), { es: "Toma la foto final. Eso marca tu salida." });
  await s.say("A site manager lands on today's day log, with a reminder to send it before you go. On the crew, you just see your hours for the day.", () => s.highlight($("#dlBody .promptbox"), "Send it before you go"), {
    es: "El supervisor llega al reporte del día, con un recordatorio de mandarlo antes de irse. En la cuadrilla, solo ves tus horas del día.",
  });
  await s.clear();
  await s.say("How did today go? Tap Record and just say it. Tap Stop when you're done.", async () => {
    await s.tap($("#dlTalk"), { after: 500 });
    await s.hear("Tear-off and dry-in on the back slope are done. ABC boomed the shingles at seven thirty. Two sheets of decking replaced over the porch.", { wordMs: 200 });
  }, { es: "¿Cómo te fue hoy? Toca «Record» y nada más dilo. Toca «Stop» cuando termines." });
  await s.tap($("#dlTalk"), { after: 900 });
  await s.say("The words land in the box, and you can fix them by typing. You can talk in English or Spanish.", () => s.highlight($("#dlStory"), "What you said"), {
    es: "Las palabras quedan en la caja, y las puedes corregir escribiendo. Puedes hablar en inglés o en español.",
  });
  await s.clear();
  await s.say("Something the PM needs right now? Tell the PM now sends what's in the box to the PM this minute. The log still goes later.", () => s.highlight($("#dlTellPm"), "Tell the PM now"), {
    es: "¿Algo que el PM necesita ahora mismo? «Tell the PM now» le manda al PM lo que está en la caja en este momento. El reporte se manda después de todos modos.",
  });
  await s.clear();
  await s.say("Then answer the questions. Any delays? Yes, and why: weather.", async () => {
    await s.tap($('[data-yn="f:22PC7jQ6BkBC"][data-v="1"]'), { after: 500 });
    await s.tap($('[data-opt="22PLhdEgfHXF"][data-val="Weather"]'), { after: 500 });
  }, { es: "Luego contesta las preguntas. ¿Algún retraso? Sí, y por qué: el clima." });
  await s.say("Anyone hurt, or a close call? If the answer is yes, a safety alert opens. It goes to the PM and the office the second you send it, without waiting for the log.", async () => {
    await s.tap($('[data-yn="safety"][data-v="1"]'), { after: 900 });
    await s.highlight($("#alertCard"), "Safety alert");
  }, { es: "¿Alguien se lastimó, o casi pasa un accidente? Si la respuesta es sí, se abre una alerta de seguridad. Le llega al PM y a la oficina en el momento que la mandas, sin esperar el reporte." });
  await s.clear();
  await s.say("Today nobody was hurt, so Tyler taps No.", () => s.tap($('[data-yn="safety"][data-v="0"]'), { after: 700 }), {
    es: "Hoy nadie se lastimó, así que Tyler toca «No».",
  });
  await s.say("Material pickups or deliveries: yes. And who else was on site: the roofers.", async () => {
    await s.tap($('[data-yn="f:22PC7jNSGzEb"][data-v="1"]'), { after: 500 });
    await s.tap($('[data-opt="22PC7jNshbiK"][data-val="Roofing"]'), { after: 500 });
  }, { es: "Recogidas o entregas de material: sí. Y quién más estuvo en la obra: los techadores." });
  await s.say("Tap Review and send to check it all on one screen.", () => s.tap($("#dlReview"), { after: 1000 }), {
    es: "Toca «Review & send» para revisar todo en una sola pantalla.",
  });
  await s.say("Your hours, your photos, every answer and your story. Then Send today's log.", async () => {
    await s.highlight($("#dlBody .rvcard, #dlBody").first(), "Check it");
    await s.wait(2200);
    await s.clear();
    await s.tap($("#dlSend"), { after: 1800 });
  }, { es: "Tus horas, tus fotos, cada respuesta y tu reporte. Luego «Send today's log»." });
  await s.say("It goes into JobTread as the job's daily log, to the PM and the sales rep. You're done for the day.", {
    es: "Entra a JobTread como el reporte diario del trabajo, para el PM y el vendedor. Terminaste por hoy.",
  });
  await s.say("On a quiet day there's a quicker way: Normal day, nothing to report, answers no to every question and sends it in one tap.", {
    es: "En un día tranquilo hay una forma más rápida: «Normal day, nothing to report» contesta que no a todas las preguntas y lo manda con un solo toque.",
  });

  // ══ PART 2 · SERVICE, REPAIR & WARRANTY ═══════════════════════════════════
  await s.part(2, "Service, repair and warranty", "Your Close Out list, and a repair from start to finish.", { say: "Parte 2. Servicio, reparación y garantía." });
  await s.do(({ page }) => page.clock.setSystemTime(new Date("2026-08-06T11:12:00Z")));
  await s.phone("service");

  // ── 7 · Your Close Out list ──────────────────────────────────────────────
  await s.chapter(7, "Your Close Out list", { who: YAHIR, es: "Tu lista de Close Out" });
  await s.uncard();
  await s.say("Service, repair and warranty work, and final inspections, live on the Close Out tab. Alberto's and Yahir's phones open straight on it.", () => s.highlight(tab("co"), "Close Out"), {
    es: "El trabajo de servicio, reparación y garantía, y las inspecciones finales, están en la pestaña «Close Out». Los teléfonos de Alberto y Yahir abren directo ahí.",
  });
  await s.clear();
  await s.say("It opens in Spanish. EN switches it to English, and ES switches it back.", async () => {
    await s.highlight($("#coQueueHead .seg, #coQueueHead [data-lang]").first(), "ES or EN");
    await s.wait(1200);
    await s.clear();
    await s.tap($('#coQueueHead [data-lang="en"]'), { after: 700 });
  }, { es: "Abre en español. «EN» lo cambia a inglés, y «ES» lo regresa a español." });
  await s.say("Assigned is your own work. All is every job waiting on close out.", () => s.highlight($("#coSeg"), "Yours, or everybody's"), {
    es: "«Assigned» es tu trabajo. «All» son todos los trabajos que esperan cierre.",
  });
  await s.clear();
  await s.say("Under it, your next two weeks, with a dot on each day you have work. Tap a day to jump to it.", () => s.highlight($("#coStrip"), "Your days"), {
    es: "Abajo, tus próximas dos semanas, con un punto en cada día que tienes trabajo. Toca un día para ir a él.",
  });
  await s.clear();
  await s.say("Each card has the job number in big type, the street, then the customer, the town and the type of job. The tag says what it is: a final inspection, or repairs and how many.", () => s.highlight($('.jcard:has([data-cojob="co-aber"])'), "One job"), {
    es: "Cada tarjeta tiene el número de trabajo en grande, la calle, y luego el cliente, el pueblo y el tipo de trabajo. La etiqueta dice qué es: una inspección final, o reparaciones y cuántas.",
  });
  await s.clear();
  await s.say("The search box finds a job by its number, a name or a street.", () => s.highlight($("#coSearchWrap"), "Search"), {
    es: "El buscador encuentra un trabajo por su número, un nombre o una calle.",
  });
  await s.clear();

  // ── 8 · A repair, start to finish ────────────────────────────────────────
  await s.chapter(8, "A repair, start to finish", { who: YAHIR, es: "Una reparación, de principio a fin" });
  await s.uncard();
  await s.say("Today Yahir has a service call: two repairs at Castellano. First, put the clock on that job. On the Clock tab, tap Change job and find it.", async () => {
    await s.tap(tab("job"), { after: 700 });
    await s.tap($("#pickJobBtn"), { after: 900 });
    await s.do(({ page }) => page.keyboard.type("8072", { delay: 90 }));
    await s.wait(900);
    await s.tap($('#jobResults [data-pick="co-cast"], #jobResults button').first(), { after: 900 });
  }, { es: "Hoy Yahir tiene una llamada de servicio: dos reparaciones en Castellano. Primero, pon el reloj en ese trabajo. En la pestaña «Clock», toca «Change job» y búscalo." });
  await s.say("Clock in, pick Service Repair Labor, and take the start photo.", async () => {
    await s.tap($("#clockIn"), { after: 700 });
    await s.tap(code("Service Repair Labor"), { after: 1500 });
    await s.tap($("#shutter"), { after: 3200 });
  }, { es: "Marca entrada, escoge «Service Repair Labor», y toma la foto de inicio." });
  await s.say("Now back to Close Out, and tap the Castellano card.", async () => {
    await s.tap(tab("co"), { after: 800 });
    await s.tap($('.jact[data-cojob="co-cast"]'), { after: 1200 });
  }, { es: "Ahora regresa a «Close Out», y toca la tarjeta de Castellano." });
  await s.say("Repairs lists what the office asked for. Mine is yours. Everyone is every repair on the job.", async () => {
    await s.tap($('[data-coscreen="repairs"]'), { after: 900 });
    await s.highlight($("#coSeg"), "Yours, or everyone's");
  }, { es: "«Repairs» muestra lo que pidió la oficina. «Mine» son las tuyas. «Everyone» son todas las reparaciones del trabajo." });
  await s.clear();
  await s.say("Open the first one. What to do is what the office asked for, and who asked. Due is the day it's booked for.", async () => {
    await s.tap($('[data-corepair="cs1"]'), { after: 900 });
    await s.highlight($("#coBody .rvcard").first(), "What to do");
  }, { es: "Abre la primera. «What to do» es lo que pidió la oficina, y quién lo pidió. «Due» es el día para el que está programada." });
  await s.clear();
  await s.say("Take a before photo of what you found. It's optional, but it shows the problem.", () => s.pick($('.phbig.empty[data-cophoto]').first(), [photo("bootOld")], { after: 1200 }), {
    es: "Toma una foto de antes de lo que encontraste. Es opcional, pero muestra el problema.",
  });
  await s.say("From my photos takes a picture you already have. An after photo has to be taken after the repair was asked for.", () => s.highlight($("#coBody .galsm").first(), "From my photos"), {
    es: "«From my photos» usa una foto que ya tienes. La foto de después tiene que ser tomada después de que se pidió la reparación.",
  });
  await s.clear();
  await s.later(35 * 60_000);
  await s.say("Fix it, then take the after photo. The after photo is required, and Done stays grey until it's in.", () => s.pick($('.phbig.empty[data-cophoto]').first(), [photo("bootNew")], { after: 1200 }), {
    es: "Arréglalo, y luego toma la foto de después. La foto de después es obligatoria, y «Done» se queda gris hasta que la tomes.",
  });
  await s.say("Add a note if it needs one, then tap Done.", () => s.tap($("#coDone"), { after: 1400 }), {
    es: "Agrega una nota si hace falta, y luego toca «Done».",
  });
  await s.say("The last repair on the job says Finish and send to PM. Finishing it sends the job to the PM for review.", async () => {
    await s.tap($('[data-corepair="cs2"]'), { after: 900 });
    await s.pick($('.phbig.empty[data-cophoto]').first(), [photo("chimney")], { after: 900 });
    await s.later(25 * 60_000);
    await s.pick($('.phbig.empty[data-cophoto]').first(), [photo("chimney")], { after: 900 });
    await s.highlight($("#coDone"), "The last repair");
  }, { es: "La última reparación del trabajo dice «Finish & send to PM». Al terminarla, el trabajo pasa al PM para que lo revise." });
  await s.clear();
  await s.say("All repairs done. Sent to the PM for review, and nothing is left for the crew on this job.", async () => {
    await s.tap($("#coDone"), { after: 1600 });
    await s.highlight($("#coBody .hero, #coBody > div").first(), "Done");
  }, { es: "Todas las reparaciones terminadas. Se mandó al PM para revisión, y no queda nada para la cuadrilla en este trabajo." });
  await s.clear();
  await s.say("A warranty call works exactly the same way. Sinclair, tomorrow, is a warranty repair.", async () => {
    await s.tap($("#coBack"), { after: 800 });
    await s.tap($("#coBack"), { after: 800 });
    await s.highlight($('.jcard:has([data-cojob="co-sinc"])'), "Warranty");
  }, { es: "Una llamada de garantía funciona exactamente igual. Sinclair, mañana, es una reparación de garantía." });
  await s.clear();

  // ══ PART 3 · CLOSE OUT ════════════════════════════════════════════════════
  await s.part(3, "Close out", "The final inspection, cleanup, problems and the send.", { say: "Parte 3. Cierre de obra." });

  // ── 9 · Starting an inspection ───────────────────────────────────────────
  await s.later(40 * 60_000);
  await s.chapter(9, "Starting a final inspection", { who: YAHIR, es: "Empezar una inspección final" });
  await s.uncard();
  await s.say("A final inspection card says Start. Start moves your clock to the job and opens the inspection, in one go.", () => s.highlight($('[data-costart="co-aber"]'), "Start"), {
    es: "Una tarjeta de inspección final dice «Start». «Start» pasa tu reloj al trabajo y abre la inspección, todo de una vez.",
  });
  await s.clear();
  await s.say("Yahir is still on the clock at Castellano, so it asks for that end photo first.", async () => {
    await s.tap($('[data-costart="co-aber"]'), { after: 1500 });
    await s.tap($("#shutter"), { after: 3000 });
  }, { es: "Yahir todavía está marcado en Castellano, así que primero pide la foto final de ese trabajo." });
  await s.say("Then the code here, Final Clean, and the start photo.", async () => {
    await s.tap(code("Final Clean"), { after: 1500 });
    await s.tap($("#shutter"), { after: 3400 });
  }, { es: "Luego el código de aquí, «Final Clean», y la foto de inicio." });
  await s.say("The job screen holds the whole visit: the inspection, the cleanup, any problems, visit photos, and what was sold.", () => s.highlight($("#coBody"), "The whole visit"), {
    es: "La pantalla del trabajo tiene toda la visita: la inspección, la limpieza, los problemas, las fotos de la visita, y lo que se vendió.",
  });
  await s.clear();
  await s.say("Sold scope tells you what the customer bought, in a few words.", () => s.highlight($('#coBody [data-coscope]'), "Sold scope"), {
    es: "«Sold scope» te dice lo que compró el cliente, en pocas palabras.",
  });
  await s.clear();

  // ── 10 · The inspection and cleanup ──────────────────────────────────────
  await s.chapter(10, "The inspection and the cleanup", { who: YAHIR, es: "La inspección y la limpieza" });
  await s.uncard();
  await s.say("The inspection is eight checks. Each one is OK, N/A, or Fix.", async () => {
    await s.tap($('[data-coscreen="inspect"]'), { after: 900 });
    await s.highlight($('.ans[data-key="22PdEQfPnVqh"]'), "OK · N/A · Fix");
  }, { es: "La inspección son ocho revisiones. Cada una es «OK», «N/A» o «Fix»." });
  await s.clear();
  await s.say("Shingles flat, drip edge secure, ridge caps seated: OK.", async () => {
    for (const k of ["22PdEQfPnVqh", "22PdEQfPnVqi", "22PdEQfPnVqj"]) await s.tap($(`.ans[data-key="${k}"] .ok`), { after: 250 });
  }, { es: "Tejas parejas, drip edge firme, caballete completo: «OK»." });
  await s.say("But a pipe boot on the back slope is cracked. Tap Fix, and it asks for a report.", () => s.tap($('.ans[data-key="22PdEQfPnVqk"] .fix'), { after: 1100 }), {
    es: "Pero una bota del tubo en la parte de atrás está rota. Toca «Fix», y te pide un reporte.",
  });
  await s.say("A report needs a photo, where it is, and a note.", () => s.pick($("#coBody [data-cophoto]").first(), [photo("bootOld")], { after: 1000 }), {
    es: "Un reporte necesita una foto, dónde está, y una nota.",
  });
  await s.say("It's on the back.", () => s.tap($("#coBody button", { hasText: /^Back$/ }).first(), { after: 500 }), { es: "Está en la parte de atrás." });
  await s.say("For the note, tap Record and say what's wrong, in English or Spanish. The office gets it in English.", async () => {
    await s.tap($("#coBody .talkbtn").first(), { after: 500 });
    await s.hear("The pipe boot on the back slope is cracked and needs replacing.", { wordMs: 210 });
  }, { es: "Para la nota, toca «Record» y di qué está mal, en inglés o en español. La oficina la recibe en inglés." });
  await s.tap($("#coBody .talkbtn").first(), { after: 900 });
  await s.say("Fixed it, on site, if you fixed it there and then. Not fixed if somebody has to come back. Then Save report.", async () => {
    await s.highlight($("#coBody .fixrow, #coBody button:has-text('Not fixed')").first(), "Fixed, or not");
    await s.wait(2400);
    await s.clear();
    await s.tap($("#coSaveReport"), { after: 1100 });
  }, { es: "«Fixed it», en la obra, si lo arreglaste ahí mismo. «Not fixed» si alguien tiene que regresar. Luego «Save report»." });
  await s.say("The rest pass. Then Next takes you to the cleanup.", async () => {
    for (const k of ["22PdEQfPnVqm", "22PdEQfPnVqn", "22PdEQfPnVqp", "22PdEQfPnVqq"]) await s.tap($(`.ans[data-key="${k}"] .ok`), { after: 220 });
    await s.tap($("#coNext"), { after: 900 });
  }, { es: "Las demás pasan. Luego «Next» te lleva a la limpieza." });
  await s.say("Then come the five cleanup checks: the magnet sweep, materials and trash gone, gutters clean, no damage, and ready for the homeowner to see.", async () => {
    for (const k of ["22PdEQhB6rSR", "22PdEQhB6rSS", "22PdEQhB6rST", "22PdEQhB6rSU", "22PdEQhB6rSV"]) await s.tap($(`.ans[data-key="${k}"] .ok`), { after: 260 });
  }, { es: "Luego vienen las cinco revisiones de limpieza: el imán, materiales y basura recogidos, canales limpios, sin daños, y listo para que lo vea el dueño." });
  await s.say("Next takes you back to the job, where Review and send is waiting.", () => s.tap($("#coNext"), { after: 900 }), {
    es: "«Next» te regresa al trabajo, donde está esperando «Review & send».",
  });

  // ── 11 · Photos and the send ─────────────────────────────────────────────
  await s.chapter(11, "Photos, and sending it", { who: YAHIR, es: "Las fotos, y mandarlo" });
  await s.uncard();
  await s.say("Visit photos show how the job was left. They're optional, but they save a trip.", async () => {
    await s.tap($('[data-coscreen="photos"]'), { after: 900 });
    await s.pick($("#coBody [data-cophoto]").first(), [photo("slope")], { after: 900 });
    await s.pick($("#coBody [data-cophoto]").first(), [photo("house")], { after: 900 });
  }, { es: "Las fotos de la visita muestran cómo quedó el trabajo. Son opcionales, pero ahorran un viaje." });
  await s.say("Back on the job, tap Review and send.", async () => {
    await s.tap($("#coBack"), { after: 800 });
    await s.tap($("#coReview"), { after: 1100 });
  }, { es: "De vuelta en el trabajo, toca «Review & send»." });
  await s.say("Check it, read what happens next, and tap Finish and send.", async () => {
    await s.highlight($("#coBody .rvcard").first(), "Check it");
    await s.wait(2200);
    await s.clear();
    await s.tap($("#coSend"), { after: 2600 });
  }, { es: "Revísalo, lee qué pasa después, y toca «Finish & send»." });
  await s.say("Sent to JobTread. It went to Dave, the PM who reviews this roof, and the job moved to Punch List, because of the problem you reported.", () => s.highlight($("#coBody .hero, #coBody > div").first(), "Sent"), {
    es: "Mandado a JobTread. Le llegó a Dave, el PM que revisa este techo, y el trabajo pasó a «Punch List», por el problema que reportaste.",
  });
  await s.clear();
  await s.say("That problem becomes a repair on the job, and comes back to the crew as a repair, the way you just saw.", {
    es: "Ese problema se convierte en una reparación del trabajo, y le regresa a la cuadrilla como reparación, como acabas de ver.",
  });
  await s.say("No signal? Everything is saved on the phone, and it sends itself as soon as there is signal.", {
    es: "¿No hay señal? Todo queda guardado en el teléfono, y se manda solo en cuanto haya señal.",
  });

  // ── 12 · Gutters and siding ──────────────────────────────────────────────
  await s.later(90 * 60_000);
  await s.chapter(12, "Gutters and siding", { who: YAHIR, es: "Canales y siding" });
  await s.uncard();
  await s.say("Some jobs have more than a roof. Fairbanks has a roof and gutters, and each one is inspected on its own.", async () => {
    await s.tap($("#coBackQueue"), { after: 900 });
    await s.tap($("#coBack"), { after: 900 });
    await s.tap($('.jmain[data-cojob="co-fair"]'), { after: 1100 });
    await s.highlight($("#coAreas"), "Each area on its own");
  }, { es: "Algunos trabajos tienen más que un techo. Fairbanks tiene techo y canales, y cada uno se inspecciona por separado." });
  await s.clear();
  await s.say("Start on the gutters moves your clock here too. Yahir is still on the clock at Abernathy, so it asks for that end photo first.", async () => {
    await s.tap($('[data-coarea="gutters"]'), { after: 1500 });
    await s.tap($("#shutter"), { after: 3000 });
  }, { es: "«Start» en los canales también pasa tu reloj aquí. Yahir todavía está marcado en Abernathy, así que primero pide la foto final de ese trabajo." });
  await s.say("Then Final Clean here, and the start photo.", async () => {
    await s.tap(code("Final Clean"), { after: 1500 });
    await s.tap($("#shutter"), { after: 3400 });
  }, { es: "Luego «Final Clean» aquí, y la foto de inicio." });
  await s.say("Gutters and siding are photos and a note. Take at least one photo of how it was left.", async () => {
    await s.pick($("#coBody [data-cophoto]").first(), [photo("gutter")], { after: 1000 });
  }, { es: "Los canales y el siding son fotos y una nota. Toma por lo menos una foto de cómo quedó." });
  await s.say("Say what you saw, if it needs saying.", async () => {
    await s.tap($("#coBody .talkbtn").first(), { after: 500 });
    await s.hear("All runs are clean and the downspouts are reconnected.", { wordMs: 200 });
    await s.tap($("#coBody .talkbtn").first(), { after: 700 });
  }, { es: "Di lo que viste, si hace falta." });
  await s.say("Then Finish and send. It goes to the PM who reviews gutters, and the board moves the job when every part of it is ready.", async () => {
    await s.tap($("#coAreaSend"), { after: 2600 });
    await s.highlight($("#coBody .hero, #coBody > div").first(), "Sent");
  }, { es: "Luego «Finish & send». Le llega al PM que revisa los canales, y el tablero mueve el trabajo cuando todas sus partes están listas." });
  await s.clear();

  // ══ PART 4 · READING THE PRODUCTION BOARD ═════════════════════════════════
  await s.part(4, "Reading the Production Board", "The war-room TVs: who goes where, and what the colours mean.", { say: "Parte 4. Cómo leer el Production Board." });
  await s.do(({ page }) => page.clock.setSystemTime(new Date("2026-08-06T11:40:00Z")));
  await s.setLayout("full");
  await s.do(({ page }) => showTv(page, "roofing"));

  // ── 13 · The war-room TV ─────────────────────────────────────────────────
  await s.chapter(13, "The war-room TV", { who: TV, es: "La televisión de la sala de juntas" });
  await s.uncard();
  await s.say("The Production Board is the office's schedule. In the war room, two TVs show it. This one has roofing, service and inspections. The other has construction.", {
    es: "El Production Board es la programación de la oficina. En la sala de juntas, dos televisiones lo muestran. Esta tiene techos, servicio e inspecciones. La otra tiene construcción.",
  });
  await s.say("It's the same schedule your phone reads. If a job is on your card here, it's in My jobs too.", {
    es: "Es la misma programación que lee tu teléfono. Si un trabajo está en tu tarjeta aquí, también está en «My jobs».",
  });
  await s.say("Across the top are six working days. Yesterday comes first, so you can check what finished. Today is outlined.", () => s.highlight(tv(".tv-headcell", { hasText: "TODAY" }), "Today"), {
    es: "Arriba hay seis días de trabajo. Ayer va primero, para que veas qué se terminó. Hoy está marcado.",
  });
  await s.clear();
  await s.say("Down the left is every crew. Find your name, and read across your row.", () => s.highlight(tv(".tv-crewname", { hasText: "Platinum Remodeling" }), "Your crew"), {
    es: "A la izquierda está cada cuadrilla. Busca tu nombre, y lee a lo largo de tu fila.",
  });
  await s.clear();
  await s.say("Each card is one job. On top, the job number. Under it, the customer and the town. Then the size of the roof in squares, and the site manager on the job.", () => s.highlight(bar("26-8127"), "One job"), {
    es: "Cada tarjeta es un trabajo. Arriba, el número de trabajo. Abajo, el cliente y el pueblo. Luego el tamaño del techo en cuadros, y el supervisor de la obra.",
  });
  await s.clear();
  await s.say("A card that runs across two days is a two-day job.", () => s.highlight(bar("26-8133"), "Two days"), {
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
    es: "«Site», en verde, quiere decir que el supervisor lo contó en el trabajo. Solo esa marca lo pone verde.",
  });
  await s.clear();
  await s.say("Short means only part of the order has gone in, and No PO means nothing has been ordered at all. Check with the office before you go on either one.", async () => {
    await s.highlight(bar("26-8159"), "Short");
    await s.wait(2200);
    await s.highlight(bar("26-8146"), "No PO");
  }, { es: "«Short» quiere decir que solo se pidió parte del material, y «No PO» quiere decir que no se ha pedido nada. Pregunta en la oficina antes de ir a cualquiera de los dos." });
  await s.clear();
  await s.say("The key along the bottom spells out every tag.", () => s.highlight(tv(".tv-legend"), "The key"), {
    es: "La guía de abajo explica cada etiqueta.",
  });
  await s.clear();
  await s.say("The band underneath is service, inspections and punch lists. A green card is a final inspection, and a purple one is a repair day.", async () => {
    await s.highlight(bar("26-8090"), "Final inspection");
    await s.wait(2600);
    await s.highlight(tv(".tv-bar", { hasText: "26-8072" }).first(), "Repair day");
  }, { es: "La franja de abajo es servicio, inspecciones y listas de reparaciones. Una tarjeta verde es una inspección final, y una morada es un día de reparaciones." });
  await s.clear();
  await s.say("The week buttons show the week ahead, or the week before. The TV comes back to this week by itself after ten minutes.", async () => {
    await s.highlight(tv(".tv-weeknav"), "Week back · week ahead");
    await s.wait(1600);
    await s.clear();
    await s.tap(tv(".tv-weekbtn", { hasText: "Week ahead" }), { after: 2200 });
    await s.tap(tv(".tv-weekbtn", { hasText: "This week" }), { after: 1600 });
  }, { es: "Los botones de semana muestran la semana siguiente, o la anterior. La televisión regresa sola a esta semana después de diez minutos." });
  await s.say("Nothing on the TV can be changed from the TV. If your card is wrong, or missing, tell the office. They fix it on the board, and the TV and your phone both follow.", {
    es: "Nada se puede cambiar desde la televisión. Si tu tarjeta está mal, o no aparece, avísale a la oficina. Ellos la arreglan en el tablero, y la televisión y tu teléfono se actualizan solos.",
  });

  // ── 14 · Wrap up ─────────────────────────────────────────────────────────
  await s.chapter(14, "That's DB Crew", { who: "", es: "Eso es DB Crew" });
  await s.say(
    "That's DB Crew. Clock in with a photo. Check My jobs for where you're going. Site managers, tick the site checks and send the day log. Service and close out, work from the Close Out tab and send it from the job.",
    { es: "Eso es DB Crew. Marca entrada con una foto. Revisa «My jobs» para saber a dónde vas. Supervisores, marquen la lista de la obra y manden el reporte del día. Servicio y cierre, trabajen desde la pestaña «Close Out» y mándenlo desde el trabajo." },
  );
  await s.say("If something in the app looks wrong, tell the office. Thanks for watching.", {
    es: "Si algo en la aplicación se ve mal, avísale a la oficina. Gracias por ver.",
  });
}
