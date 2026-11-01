/**
 * Discogs's credit roles, by the heading they're listed under on its
 * credits list (https://www.discogs.com/help/creditslist). The unlinked
 * variants Discogs lists without a heading go with their linked twins
 * ("Written By" with "Written-By", "Artwork By" with "Artwork"...), and
 * every Instruments subgroup (percussion, keyboards, strings, wind,
 * technical and other musical) is one heading here.
 *
 * Names are as Discogs spells them; `roleCategories.ts` matches them
 * ignoring case, accents, spaces and punctuation.
 */

const list = (names: string) =>
  names
    .split("|")
    .map((n) => n.trim())
    .filter(Boolean);

export const DISCOGS_ROLES = {
  vocals: list(`
    Alto Vocals|Backing Vocals|Baritone Vocals|Bass Vocals|Bass-Baritone Vocals|
    Caller|Cantor|Choir|Chorus|Contralto Vocals|Coro|Countertenor Vocals|Eefing|
    Harmony Vocals|Human Beatbox|Humming|Joik|Kakegoe|Lead Vocals|MC|
    Mezzo-soprano Vocals|Overtone Voice|Rap|Satsuma|Scat|Solo Vocal|
    Soprano Vocals|Speech|Tenor Vocals|Toasting|Treble Vocals|Vocal Percussion|
    Vocalese|Vocals|Voice|Whistling|Yodeling`),

  instruments: list(`
    Adufe|Afoxé|Agogô|Alegre|Ashiko|Atabal|Bapang|Bass Drum|Bata|Bell Tree|Bells|
    Bendir|Bodhrán|Body Percussion|Bombo|Bones|Bongos|Buhay|Buk|Cabasa|Caixa|
    Caja Vallenata|Cajón|Calabash|Castanets|Caxixi|Chácaras|Chak'chas|Chanchiki|
    Changgo|Chinchín|Ching|Ching-Dong|Clap Sticks|Claves|Congas|Cowbell|Cuica|
    Cultrun|Cymbal|Daf|Darbouka|Davul|Dhol|Dholak|Dikanza|Djembe|Doira|Doli|
    Drum|Drum Programming|Drums|Dunun|Electronic Drums|Finger Cymbals|
    Finger Snaps|Flamenco Dance|Frame Drum|Friction Drum|Frottoir|Ganzá|Ghatam|
    Ghungroo|Goblet Drum|Gong|Gong Chime|Gorosu|Guacharaca|Güira|Guiro|
    Hand Drum|Handbell|Handclaps|Handpan|Hihat|Hosho|Hyoshigi|Idiophone|Jaggo|
    Janggu|Jing|K'kwaengwari|Ka|Kagura Suzu|Kanjira|Karkabas|Kebero|Kendang|
    Khartal|Khurdak|Kynggari|Lagerphone|Lion's Roar|Llamador|Madal|Mallets|
    Maracas|Monkey stick|Mridangam|Naqareh|Narimono|Oodaiko|Pakhavaj|Pandeiro|
    Percussion|Quijada|Rainstick|Ratchet|Rattle|Ravanne|Reco-reco|Repinique|
    Rototoms|Sabar|Sanba|Scraper|Shaker|Shakubyoshi|Shekere|Shuitar|
    Singing Bowls|Sistrum|Skratjie|Slapstick|Slit Drum|Snare|Spoons|Stomp Box|
    String Drum|Surdo|Surigane|Suzu|T'rung|Taal|Taarija|Tabl Baladi|Tabla|Taiko|
    Talking Drum|Tam-tam|Tambora|Tamboril|Tamborim|Tambourine|Tan-Tan|Tap Dance|
    Tar (Drum)|Tbal|Temple Bells|Temple Block|Thavil|Thunder Sheet|Tifa|
    Timbales|Timpani|Tingsha|Tom Tom|Tombak|Toubeleki|Trancanholas|Triangle|
    Tsuzumi|Tüngür|Udu|Vibraslap|Wadaiko|Washboard|Waterphone|Wood Block|
    Zabumba|

    Amadinda|Angklung|Balafon|Bass Marimba|Boomwhacker|Carillon|Celesta|Chimes|
    Cristal Baschet|Crotales|Glockenspiel|Guitaret|Hammered Dulcimer|Jal Tarang|
    Kalimba|Lamellophone|Marimba|Marimbula|Metallophone|Musical Box|Prempensua|
    Santoor|Santur|Slagbordun|Steel Drums|Thumb Piano|Tubaphone|Tubular Bells|
    Tun|Txalaparta|Vibraphone|Xylophone|Xylorimba|

    Baby Grand Piano|Chamberlin|Claviorgan|Concert Grand Piano|Dulcitone|
    Electric Harmonium|Electric Harpsichord|Electric Organ|Electric Piano|
    Fortepiano|Grand Piano|Harmonium|Harpsichord|Keyboards|Luthéal|Mellotron|
    Melodica|Omnichord|Ondes Martenot|Organ|Parlour Grand Piano|Pedalboard|
    Piano|Pipe Organ|Player Piano|Portative Organ|Positive Organ|Pump Organ|
    Reed Organ|Regal|Samvadini|Stylophone|Synth|Synth Bass|Synthesizer|
    Tangent Piano|Toy Piano|Upright Piano|Virginal|

    12-String Acoustic Guitar|12-String Bass|12-string Electric Guitar|
    5-String Banjo|5-String Bass|6-String Banjo|6-String Bass|
    7-string Acoustic Guitar|7-string Electric Guitar|8-string Bass Guitar|
    8-string Electric Guitar|8-string Guitar|Acoustic Bass|Acoustic Guitar|
    Acoustic Piccolo Bass|Adungu|Ajaeng|Alto Balalaika|Alto Domra|Alto Guitar|
    Alto Viol|Angélique|Archlute|Arco Bass|Ardin|Arpa|Autoharp|Baglama|
    Bajo Quinto|Bajo Sexto|Balalaika|Bandola|Bandolin|Bandora|Bandura|Bandurria|
    Banhu|Banjo|Banjolin|Baritone Guitar|Baroque Guitar|Baroque Violin|Baryton|
    Bass Balalaika|Bass Domra|Bass Guitar|Bass Viol|Bass Violin|Begena|Berimbau|
    Bhapang|Biwa|Blaster Beam|Bolon|Bouzouki|Bowed Dulcimer|Bowed Psaltery|
    Bulbul Tarang|Buzuq|Byzaanchi|Cavaquinho|Cello|Cello Banjo|Celtic Harp|
    Cetara|Changi|Chanzy|Chapman Stick|Charango|Chitarra Battente|Chitarrone|
    Chonguri|Chord Zither|Chuniri|Cigar Box Guitar|Cimbalom|Citole|Cittern|
    Clàrsach|Classical Guitar|Clavichord|Clavinet|Cobza|Contrabass|
    Contrabass Balalaika|Contrabass Domra|Crwth|Cuatro|Cümbüş|Cura|Deaejeng|
    Diddley Bow|Dilruba|Dobro|Dojo|Dombra|Domra|Doshpuluur|Dotara|Double Bass|
    Dulcimer|Dutar|Đàn bầu|Đàn Nguyệt|Đàn Tranh|Đàn Tỳ Bà|Ektare|
    Electric Banjo|Electric Bass|Electric Cello|Electric Guitar|Electric Harp|
    Electric Mandolin|Electric Pipa|Electric Sitar|Electric Upright Bass|
    Electric Viola|Electric Violin|Epinette des Vosges|Erhu|Esraj|Fiddle|
    Fidel Płocka|Five-String Viola|Five-String Violin|Flamenco Guitar|
    Fretless Banjo|Fretless Bass|Fretless Guitar|Gadulka|Gaohu|Gayageum|
    Geomungo|Ghaychak|Ghijak|Giga|Gittern|Gottuvâdyam|Gravikord|Guimbri|
    Guitalele|Guitar|Guitar Banjo|Guitar Synthesizer|Guitarra Séptima|Guitarrón|
    GuitarViol|Guqin|Gusle|Gusli|Guzheng|Haegum|Halldorophone|Hardanger d'Amore|
    Hardingfele|Harp|Harp Guitar|Harpeleik|Hayashi|Hualaycho|Huapanguera|Hummel|
    Huqin|Hurdy Gurdy|Ichigenkin|Igil|Inānga|Indian Slide Guitar|Irish Bouzouki|
    Jarana|Jinghu|Jouhikko|Kabosy|Kamancha|Kanklės|Kannel|Kantele|Kanun|
    Kemenche|Kirar|Kobyz|Kokle|Kokyu|Komuz|Konghou|Kora|Koto|Krar|Kravik Lyre|
    Langeleik|Langspil|Laouto|Lap Steel Guitar|Laúd|Lavta|Lead Guitar|Lira|
    Lira da Braccio|Lirone|Liuqin|Lute|Lute Guitar|Lyra Viol|Lyre|Mandobass|
    Mandocello|Mandoguitar|Mandola|Mandole|Mandolin|Mandolin Banjo|
    Mandolincello|Marxophone|Masinko|Misolo Guitar|Mohan Veena|Monochord|
    Morinhoor|Mountain Dulcimer|Musical Bow|N'vike|Ngoni|Nigenkin|Nyckelharpa|
    Octave Violin|Octavina|Octophone|Open-Back Banjo|Organistrum|Orpharion|Oud|
    Outi|Panduri|Pedal Harp|Pedal Steel Guitar|Phin|Piccolo Balalaika|
    Piccolo Banjo|Piccolo Bass Guitar|Piccolo Domra|Pipa|Plectrum Banjo|
    Portuguese Guitar|Psalmodicon|Psaltery|Rabab|Rabeca|Rabel|Rebab|Rebec|
    Reikin|Requinto Guitar|Resonator Banjo|Resonator Guitar|Resonator Mandolin|
    Rhythm Guitar|Ronroco|Ruan|Rudra Veena|Sanshin|Sanxian|Sapeh|Sarangi|Sarod|
    Sazbus|Selmer-Maccaferri Guitar|Semi-Acoustic Guitar|Semistrunnaya Gitara|
    Seperewa|Setar|Shahi Baaja|Shamisen|Sintir|Sitar|Slide Guitar|Soku|
    Soprano Guitar|Spinet|Steel Guitar|Strings|Stroh Violin|Strumstick|
    Suka Biłgorajska|Surbahar|Svara Mandala|Swarmandel|Sympitar|SynthAxe|
    Taishōgoto|Talharpa|Tambura|Tamburitza|Tapboard|Tar (lute)|Tarawangsa|
    Tea Chest Bass|Tenor Balalaika|Tenor Banjo|Tenor Domra|Tenor Guitar|
    Tenor Viol|Tenor Violin|Theorbo|Timple|Tiple|Tipple|Tololoche|Tonkori|Torban|
    Touch Guitar|Tovshuur|Träskofiol|Treble Viol|Tres|Tromba Marina|Tumbi|
    Twelve-String Guitar|Tzouras|Ukulele|Ukulele Banjo|Ütőgardon|Valiha|Veena|
    Vielle|Vihuela|Viol|Viola|Viola Beiroa|Viola Braguesa|Viola Caipira|
    Viola d'Amore|Viola da Gamba|Viola da Terra|Viola de Cocho|Viola Kontra|
    Viola Nordestina|Viola Pomposa|Violão de sete cordas|Violin|Violino Grande|
    Violino Piccolo|Violoncello|Violone|Washtub Bass|Xalam|Yang T'Chin|
    Yanggeum|Yangqin|Yueqin|Zeze|Zither|Zongora|

    Accordina|Accordion|Aerophone|Algoza|Alphorn|Alto Clarinet|Alto Flute|
    Alto Horn|Alto Recorder|Alto Saxophone|Alto Trombone|Alto Trumpet|Apito|
    Arghul|Bagpipes|Bandoneon|Bansuri|Baritone Clarinet|Baritone Horn|
    Baritone Saxophone|Barrel Organ|Bass Clarinet|Bass Flute|Bass Harmonica|
    Bass Recorder|Bass Saxophone|Bass Trombone|Bass Trumpet|Bass Tuba|
    Basset Clarinet|Basset Horn|Bassoon|Bawu|Bayan|Bellowphone|Beresta|Birbynė|
    Blues Harp|Bolivian Flute|Bombarde|Border Pipes|Brass|Brass Bass|Bucium|
    Bugle|Bukkehorn|C Melody Saxophone|Cabrette|Cajun Accordion|Caramusa|Carnyx|
    Chabrette|Chalumeau|Chanter|Charamel|Chirimia|Clarín Cajamarquino|Clarinet|
    Clarion|Claviola|Comb|Concert Flute|Concertina|Conch|Contra-Alto Clarinet|
    Contrabass Clarinet|Contrabass Flute|Contrabass Saxophone|
    Contrabass Trombone|Contrabassoon|Cor Anglais|Cornet|Cornett|Couesnophone|
    Cromorne|Crumhorn|Daegeum|Danso|Didgeridoo|Dili Tuiduk|Dizi|Dord|
    Double Horn|Drone|Duduk|Dulcian|Dulzaina|Dvojačka|Electronic Accordion|
    Electronic Valve Instrument|Electronic Wind Instrument|English Horn|
    Euphonium|Fife|Flageolet|Flugabone|Flugelhorn|Fluier|Flumpet|Flute|
    Flute D'Amour|Free-reed Flute|French Horn|Friscaletto|Fujara|Gaita|Galoubet|
    Gammu Burrwi|Garklein Recorder|Garmon|Gemshorn|Gralla|Gudastviri|Harmet|
    Harmonica|Heckelphone|Helicon|Hichiriki|Highland Pipes|Hojok|Horagai|Horn|
    Horns|Hotchiku|Hulusi|Hunting Horn|Irish Flute|Jug|Kagurabue|Kaval|Kawala|
    Kazoo|Khene|Khromka|Kortholt|Launeddas|Limbe|Liru|Low Whistle|Lur|Lyricon|
    Mänkeri|Mellophone|Melodeon|Mey|Mizmar|Mizwad|Moceño|Mouth Organ|Murli|
    Musette|Nadaswaram|Ney|Northumbrian Pipes|Nose Flute|Oboe|Oboe d'Amore|
    Oboe Da Caccia|Ocarina|Ophicleide|Overtone Flute|Panpipes|Piano Accordion|
    Piccolo Flute|Piccolo Trumpet|Pifana|Pipe|Piri|Pirula|Pito|Pito Herreño|
    Pixiephone|Pommer|Pututo|Quena|Quenacho|Quray|Rackett|Rauschpfeife|
    Recorder|Reeds|Rhaita|Rondador|Rozhok|Ryuteki|Sackbut|Saenghwang|Salamuri|
    Sampona|Sarrusophone|Saxello|Saxhorn|Saxophone|Schwyzerörgeli|Serpent|
    Shakuhachi|Shanai|Shawm|Shenai|Sheng|Shinobue|Sho|Shofar|Shruti Box|
    Slide Trumpet|Slide Whistle|Smallpipes|Sodina|Sopilka|Sopranino Recorder|
    Sopranino Saxophone|Sopranissimo Saxophone|Soprano Clarinet|Soprano Cornet|
    Soprano Flute|Soprano Recorder|Soprano Saxophone|Soprano Trombone|Sordun|
    Souna|Sousaphone|Steirische Harmonika|Subcontrabass Saxophone|Suling|Suona|
    Svirel|Taepyungso|Tambin|Tarka|Tárogató|Tenor Flute|Tenor Horn|
    Tenor Recorder|Tenor Saxophone|Tenor Trombone|Tenora|Ti-tse|Tible|
    Tin Whistle|Tonette|Traverso|Trombone|Trumpet|Trutruka|Tsuur|Tuba|
    Tussefløyte|Txirula|Txistu|Uilleann Pipes|Valve Trombone|Valve Trumpet|
    Vessel Flute|Wagner Tuba|Washint|Whistle|Whistling Water Jar|Wind|Woodwind|
    Xiao|Xun|Yokobue|Yorgaphone|Zhaleika|Zukra|Zurna|

    Artificial Intelligence (AI)|Automatic Orchestra|Computer|Drum Machine|
    Effects|Electronics|Groovebox|Loops|MIDI Controller|Noises|Sampler|
    Scratches|Sequencer|Software Instrument|Talkbox|Tannerin|Tape|Theremin|
    Turntables|Vocoder|

    Accompanied By|Audio Generator|Backing Band|Bass|Basso Continuo|Brass Band|
    Bullroarer|Concert Band|Concertino|Devil's Fiddle|E-Bow|Gamelan|Gizmotron|
    Glass Harmonica|Glass Harp|Homus|Hydraulophone|Instruments|Jew's Harp|Mbira|
    Megaphone|Morchang|Musician|Objects|Orchestra|Rhythm Section|Samples|Saw|
    Siren|Soloist|Sounds|Taonga pūoro|Tifa Totobuang|Toy|Trautonium|Wind Chimes|
    Wobble Board`),

  featuring: list(`
    Band|Ensemble|Featuring|Guest|Hosted By|Performer|Presenter`),

  conducting: list(`
    Chorus Master|Concertmaster|Concertmistress|Conductor|Contractor|
    Directed By|Leader|Music Director|Repetiteur`),

  writing: list(`
    Written By|Written-By|Adapted By|Arranged By|Beats|Cadenza|Composed By|
    Concept By|Copyist|Created By|Instrumentation By|Libretto By|Lyrics By|
    Music By|Musical Assistance|Music Consultant|Orchestrated By|Programmed By|
    Score|Score Editor|Sequenced By|Songwriter|Sound Designer|Transcription By|
    Translated By|Words By`),

  production: list(`
    Co-producer|Collected By|Commissioned By|Compilation Producer|Compiled By|
    Curated By|Editor|Executive-Producer|Executive Producer|Post Production|
    Producer|Recording Supervisor|Reissue Producer|Research|Supervised By`),

  remix: list(`Remix`),

  djmix: list(`DJ Mix`),

  technical: list(`
    Authoring|Crew|DAW|Direct Metal Mastering By|Edited By|Engineer|Equipment|
    Field Recording|Instrument Builder|Lacquer Cut By|Lathe Cut By|
    Lathe Designer|Luthier|Mastered By|Mixed By|Overdubbed By|Plated By|
    Recorded By|Remastered By|Restoration|Tape Op|Technician|Tracking By|
    Transferred By|Tuner`),

  visual: list(`
    Artwork By|Photography|Animation|Art Direction|Artwork|Assemblage|
    Calligraphy|Camera Operator|CGI Artist|Cinematographer|Costume Designer|
    Cover|Creative Director|Design|Design Concept|Desk-top Publishing|
    Director Of Photography|Drawing|Film Director|Film Editor|Film Producer|
    Film Technician|Filmed By|Footage By|Gaffer|Graphic Design|Graphics|Grip|
    Hair|Illustration|Image Editor|Layout|Lettering|Lighting|Lighting Director|
    Lithography|Logo|Make-Up|Model|Painting|Photography By|Production Manager|
    Realization|Scenographer|Screen Printing|Set Designer|Sleeve|Stage Manager|
    Stylist|Typography|Video Director|Video Editor|Video Producer|
    Video Technician|Videography|VJ`),

  spoken: list(`
    Abridged By|Adapted By (Text)|Announcer|Author|Booklet Editor|
    Choreography|Commentator|Dialog|Dramaturge|Interviewee|Interviewer|
    Liner Notes|Music Librarian|Narrator|Proofreader|Read By|Screenwriter|
    Script By|Sleeve Notes|Text By|Voice Actor`),

  management: list(`
    A&R|Administrator|Advisor|Booking|Consultant|Coordinator|Legal|Management|
    Marketing|Merchandising|Product Manager|Project Manager|Promotion|
    Public Relations|Tour Manager|Vocal Coach`),

  other: list(`Other`),
} as const;
