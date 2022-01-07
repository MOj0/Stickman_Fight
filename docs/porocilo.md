# Racunalniska grafika - Stickman Fight
## Avtorja:
## Matija Ojo
## Jan Renar

## 1. Uvod

V okviru WebGL-a sva naredila igro, pri kateri se 3D stick figure bojujejo. Implementirala sva skeletalne animacije za model uvozen iz programa Blender, vecigralski nacin preko omrezja ter preprost skybox. Kamera je tretjeosebna.

## 2. Inspiracija

Inspiracija prihaja iz starjesih videoposnetkov in iger, kjer so se stick figure med seboj bojevale. Kot otroku, so se mi te stvari zdele zelo zanimive in zabavne, od kod se mi je porodila ideja, da bi sami naredili tovrstno igrico, saj je ze sama misel o tem zelo razburljiva.

## 3. Skeletalne animacije

Za osnovo sva vzela primera 17-game in 90-gltf iz spletne ucilnice. Zatem je bilo potrebno dobiti 3D model, nakar sem nasel [zelo dober Blender tutorial](https://www.youtube.com/watch?v=xFqdgFA6zi4), ki pokaze kako narediti 3D stick figuro ter jo "skinnati" (postaviti kosti, tako da so pripravljene za animacijo). Ker sem v programu Blender delal prvic, sem si pomagal tudi s tutoriali [Sebastian Lague-a](https://www.youtube.com/c/SebastianLague), pri cemer sem se kar veliko naucil. Ustvaril sem 3D stick figuro, tako da sem sledil tutorialu, na koncu sem razsiril 3D model s tem da sem dodal animacije, ki se sprozijo, ko uporabnik uspesno opravi kombo.

Ko je bil model pripravljen za uvoz, sva naletela na prve *resnejse* probleme - model, armaturo (kosti) in animacije je bilo potrebno iz gltf datoteke *parsati* v smiselno podatkovno struktro. Spet sem nasel [kar dober tutorial](https://www.youtube.com/watch?v=owbLvgjIPzQ), kjer je razlozena koda za tovrstni problem. Nekje na tej tocki sem spoznal, da so animacije pravzaprav zahtevne, prebral sem vecino [WebGLFundamentals clankov](https://webgl2fundamentals.org/), in analiziral kodo, vendar je kode bilo ogromno in bila je relativno zapletena. Nato sem nasel [izjemno dober clanek](https://veeenu.github.io/blog/implementing-skeletal-animation/), ki zelo dobro razlozi skeletalne animacije z zelo malo kode. Pravzaprav je vecina vertex shader-ja zelo podobnega tistemu v clanku. Po velikem stevilu bug-ov mi je koncno uspelo prikazati animacijo, ki sem jo naredil v Blenderju na pravilen nacin.

Objekt igralca ima kosti kot otroke, ki povedo kako premaktniti tocke na katere so bind-ane. Ob klicu animacije, se matrike poracunajo po hierarhiji (pomembno je da se najprej obdela starse, saj le tako zagotovimo hierarhijo) in se poslejejo v vertex shader. Ta pa iz podane matrike kosti le izracuna koordinate novih tock (vertex-ov), s tem da uposteva utezi med dvema zaporednima kostema. Koncna pozicija tocke je naslendja: `gl_Position = uModelViewProjection * bt * aPosition;`, kjer je `bt` BoneTransform matrika.

## 4. Kamera in kontrole

Naslednji korak je bil pravilno postaviti kamero in obrniti igralca, da gleda v smeri kamere. Sprva sem skusal to storiti tako, da je kamera otrok igralca, vendar sem kasneje to storil tako da se pozicija kamere vsak frame nastavi na pozicijo igralca, nato pa se Z os premakne za ViewDistance, ki ga uporabnik spreminja z scrollanjem miske.

Stick figuro se premika z tipicnimi WASD tipkami, kamero se premika z misko, napada se pa z puscicami - arrow keys. Pri tem je mozno narediti t.i. kombo, ki se sprozi ko uporabnik stori zaporedje vec ustreznih kombinacij tipk/napadov, ob cemer se sprozi tudi posebna animacija. Ko uporabnik stori kombo in zadane nasprotnika je nagrajen s tem da so njegovi naslednji napadi mocnejsi, ce pa uporabnik kombo zamoci, gre stick figura v stanje "Tired" in nekaj casa ne more napadati. To preprecuje tudi to da uporabniki ne bi samo stiskali na en napad in zmagali. Cilj igre je torej narediti kombote hitreje kot nasprotnik ga tako poraziti.

## 5. Skybox

Na internetu sem nasel teksturo, ki je primerna / podobna igri, v blenderju pa jo "nalepil" na kocko. Trenutno se vidijo robovi kocke, saj tekstura ni v ustrezni obliki "unwrappanega" kvadrata (to lahko se improvam). Poiskusil sem tudi narediti skyball, vendar je bila locnica med zacetkom in koncem teksture bila prevec moteca.

## ... LIGHTING, OUTLINE ...

## 6. Networking

Socket.io je odprtokodna Javascript knjižnica za spletne aplikacije, ki se izvajajo v realnem času. Omogoča obojestransko komunikacijo med strežnikom in odjemalci z uporabo protokola HTTP in Websocket-ov. Sestavljena je iz dveh delov: knjižnice na strani odjemalcev, ki jo izvaja brskalnik in knjižnice Node.js na strani strežnika. Velika prednost socket.io knjižnice je podpora za asinhrono oziroma nesekvenčno izvajanje. Pri spletnih aplikacijah, ki delujejo v realnem času je to ključnega pomena, saj gre za velike količine podatkov in dogodkov, ki se vsi izvajajo sočasno. V primeru, da ne bi uporabljali tega načina, bi se vsak nov dogodek, izvedel šele po koncu prejšnjega, kar bi upočasnilo delovanje strežnika in posledično spletne aplikacije.
Stanje igre predstavlja položaje igralcev, njihove pridobljene točke (XP in Combo Multiplier) ter njihove udarce, v nekem določenem trenutku. Ti podatki so shranjeni tako na strežniku kot odjemalcu. Odjemalec po vsakem klicu metode update() pošlje strežniku posodobitev svojega stanja. Iz zahteve strežnik razbere, kateri odjemalec pošilja posodobitev, ga poišče (v tabeli, kjer so shranjeni vsi prisotni igralci) in mu posodobi stanje. Ker gre za igro v realnem času, mora biti komunikacija med strežnikom in odjemalci obojestranska, da lahko tudi odjemalci prejmejo posodobitve stanja kar se da hitro. S tem namenom, ima strežnik ustvarjeno metodo heartbeat(), ki vsakih 10 milisekund, pošlje trenutno stanje igre vsem odjemalcem. To poskrbi, da imajo vsi odjemalci usklajene podatke o trenutnem stanju igre. Posodobitev vsakih 10 milisekund predstavlja 100 poslanih zahtev vsako sekundo, kar pozitivno vpliva na uporabniško izkušnjo. Če bi bil interval daljši, bi bili zamiki in skoki ostalih igralcev veliko bolj opazni. To se zgodi, če odjemalec nekaj časa ne prejme posodobitve, ostale igralce izrisuje na zadnji poznani lokaciji, ko pa dobi posodobitev, pride do zelo opaznega preskoka, ko igralce spet izriše na novih položajih. Ker smo se odločili za preprostejšo implementacijo strežnika in odjemalcev, metode kot so interpolacija položajev igralcev ali napovedovanje njihovih premikov, ne uporabljamo. Kot možno izboljšavo bi seveda lahko uporabili drugačno implementacijo strežnika z uporabo komunikacije preko UDP protokola (npr. WebRTC).
Podatki katere si izmenjujejo odjemalci in strežnik so običajni Javascript objekti, ki vsebujejo relevantne podatke. Tako odjemalci kot strežnik imajo določene event listenerje, ki se sprožijo ko socket.io knjižnica prejme sporočilo prek omrežja z pravilnimi parametri. Te metode so uporabljene vsakič, kadar strežnik pošilja podatke odjemalcu. Primer take metode je socket.on("updatePosition", x,y), ko je ta metoda izvedena, bo igralcu posodobila položaj, na prejete koordinate x in y. Sledi še izpis v konzolo, kjer lahko vidimo prejete podatke.

## 7. Zakljucek

Ceprav je v igri le 1 model in le 1 tekstura, je bilo dela kar veliko. Vecina casa razvoja igre je bila namenjena animacijam, pri cemer sem se ogromno naucil, tako WebGL-a (shaderji, kosti, parsanje animacij), kot tudi programa Blender, saj sem 3D model naredil sam. Vesel sem, da sva se za ta projekt odlocila, ga dokoncala in se veliko naucila.