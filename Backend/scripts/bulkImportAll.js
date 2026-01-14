// Add all employees and branches from the provided data
import pool from '../config/db.js';
import bcrypt from 'bcryptjs';

// All branches/properties from your data
const branches = [
  { name: 'Head Office', code: 'HQ' },
  { name: 'Brit Hotel', code: 'BRIT' },
  { name: 'Burrows Court', code: 'BC' },
  { name: 'BW Atlantic', code: 'BWA' },
  { name: 'Clacton Pier Avenue', code: 'CPA' },
  { name: 'Dudley Hotel', code: 'DUD' },
  { name: 'Engagement Team', code: 'ENG' },
  { name: 'Field Operations', code: 'FOPS' },
  { name: 'Finance', code: 'FIN' },
  { name: 'Hilton Hampton Ealing', code: 'HHE' },
  { name: 'Holiday Inn Express Lambeth', code: 'HIEL' },
  { name: 'Holiday Inn Old Street', code: 'HIOS' },
  { name: 'Holiday Inn Swiss Cottage', code: 'HISC' },
  { name: 'IBIS Budget Bishops Stortford', code: 'IBBS' },
  { name: 'IBIS Cardiff', code: 'IBC' },
  { name: 'Ibis Styles Seven Kings', code: 'IS7K' },
  { name: 'Incidents & Safeguarding', code: 'INC' },
  { name: 'Lea Halls', code: 'LEA' },
  { name: 'Leigham Court Hotel', code: 'LCH' },
  { name: 'Maida Vale Apart Hotel', code: 'MVAH' },
  { name: 'Mercure Heathrow', code: 'MH' },
  { name: 'Parmiter', code: 'PAR' }
];

// All employees from your data
const employees = [
  // Head Office (11)
  { name: 'Anhar Meah', email: 'anhar.meah@sdcommercial.com', role: 'manager', branch: 'Head Office', position: 'Escalation Manager' },
  { name: 'Azeem Salemohamed', email: 'azeem.salemohamed@sdcommercial.com', role: 'staff', branch: 'Head Office' },
  { name: 'Fayyas Abdul Jabbar', email: 'fayyas.jabbar@sdcommercial.com', role: 'manager', branch: 'Head Office', position: 'HR Manager' },
  { name: 'Irene Florie Odoge', email: 'irene.odoge@sdcommercial.com', role: 'staff', branch: 'Head Office' },
  { name: 'Liban Mohamed', email: 'liban.mohamed@sdcommercial.com', role: 'staff', branch: 'Head Office', position: 'Incident Admin' },
  { name: 'Manoj Cancar', email: 'manoj.cancar@sdcommercial.com', role: 'staff', branch: 'Head Office' },
  { name: 'Mohamed Kabba', email: 'mohamed.kabba@sdcommercial.com', role: 'staff', branch: 'Head Office', position: 'Incident Admin' },
  { name: 'Omolara Sufianu', email: 'omolara.sufianu@sdcommercial.com', role: 'staff', branch: 'Head Office', position: 'Social Liaison Officer' },
  { name: 'Pavan Kumar Karumanchi', email: 'pavan.karumanchi@sdcommercial.com', role: 'staff', branch: 'Head Office' },
  { name: 'Thanzila Islam', email: 'thanzila.islam@sdcommercial.com', role: 'staff', branch: 'Head Office', position: 'Incident Admin' },

  // Brit Hotel (8)
  { name: 'Ashok Yendluri', email: 'ashok.yendluri@sdcommercial.com', role: 'staff', branch: 'Brit Hotel', position: 'Housing Officer' },
  { name: 'Gorabuda Shaik', email: 'gorabuda.shaik@sdcommercial.com', role: 'staff', branch: 'Brit Hotel', position: 'Housing Officer' },
  { name: 'Joella Fernandes', email: 'joella.fernandes@sdcommercial.com', role: 'staff', branch: 'Brit Hotel', position: 'Housing Officer' },
  { name: 'Mohammad Valiya Peedikayil', email: 'mohammad.peedikayil@sdcommercial.com', role: 'staff', branch: 'Brit Hotel', position: 'Housing Officer' },
  { name: 'Musthafa Naduvila purayil', email: 'musthafa.naduvila@sdcommercial.com', role: 'staff', branch: 'Brit Hotel', position: 'Housing Officer' },
  { name: 'Raviteja Gollapudi', email: 'raviteja.gollapudi@sdcommercial.com', role: 'staff', branch: 'Brit Hotel', position: 'Housing Officer' },
  { name: 'Rumin Hasan', email: 'rumin.hasan@sdcommercial.com', role: 'manager', branch: 'Brit Hotel', position: 'Housing Manager' },
  { name: 'Sai Obula', email: 'sai.obula@sdcommercial.com', role: 'staff', branch: 'Brit Hotel', position: 'Housing Officer' },

  // Burrows Court (15)
  { name: 'Aamir Saber', email: 'aamir.saber@sdcommercial.com', role: 'staff', branch: 'Burrows Court', position: 'Housing Officer' },
  { name: 'Amarnath Gandla', email: 'amarnath.gandla@sdcommercial.com', role: 'staff', branch: 'Burrows Court' },
  { name: 'Awad Mousa Adam Alobaid', email: 'awad.alobaid@sdcommercial.com', role: 'staff', branch: 'Burrows Court', position: 'Housing Officer' },
  { name: 'Dilton Antonio', email: 'dilton.antonio@sdcommercial.com', role: 'staff', branch: 'Burrows Court', position: 'Housing Officer' },
  { name: 'Hashim Aldhaw', email: 'hashim.aldhaw@sdcommercial.com', role: 'staff', branch: 'Burrows Court', position: 'Housing Officer' },
  { name: 'Hisham Muhammed Shafeeq', email: 'hisham.shafeeq@sdcommercial.com', role: 'staff', branch: 'Burrows Court', position: 'Housing Officer' },
  { name: 'Majid Doroodgar', email: 'majid.doroodgar@sdcommercial.com', role: 'staff', branch: 'Burrows Court', position: 'Housing Officer' },
  { name: 'Makaila Mackenzie Seaton', email: 'makaila.seaton@sdcommercial.com', role: 'staff', branch: 'Burrows Court', position: 'Housing Officer' },
  { name: 'Naomi Boakye', email: 'naomi.boakye@sdcommercial.com', role: 'staff', branch: 'Burrows Court', position: 'Housing Officer' },
  { name: 'Narayana Babu Chamana', email: 'narayana.chamana@sdcommercial.com', role: 'staff', branch: 'Burrows Court', position: 'Housing Officer' },
  { name: 'Ozgur Gunes', email: 'ozgur.gunes@sdcommercial.com', role: 'staff', branch: 'Burrows Court', position: 'Housing Officer' },
  { name: 'Poonam Gill', email: 'poonam.gill@sdcommercial.com', role: 'staff', branch: 'Burrows Court', position: 'Housing Officer' },
  { name: 'Robin Robin', email: 'robin.robin@sdcommercial.com', role: 'staff', branch: 'Burrows Court', position: 'Housing Officer' },
  { name: 'Sean Corry', email: 'sean.corry@sdcommercial.com', role: 'staff', branch: 'Burrows Court', position: 'Housing Officer' },
  { name: 'Shane Seerey', email: 'shane.seerey@sdcommercial.com', role: 'staff', branch: 'Burrows Court', position: 'Housing Officer' },

  // BW Atlantic (7)
  { name: 'Anil Kurma', email: 'anil.kurma@sdcommercial.com', role: 'staff', branch: 'BW Atlantic', position: 'Welfare Officer' },
  { name: 'Giulia Botteon', email: 'giulia.botteon@sdcommercial.com', role: 'staff', branch: 'BW Atlantic', position: 'Welfare Officer' },
  { name: 'Iqra Noor', email: 'iqra.noor@sdcommercial.com', role: 'staff', branch: 'BW Atlantic', position: 'Welfare Officer' },
  { name: 'Lubna Sahmoud', email: 'lubna.sahmoud@sdcommercial.com', role: 'staff', branch: 'BW Atlantic', position: 'Welfare Officer' },
  { name: 'Mohammad Sohail', email: 'mohammad.sohail@sdcommercial.com', role: 'staff', branch: 'BW Atlantic', position: 'Welfare Officer' },
  { name: 'Rishi Begari', email: 'rishi.begari@sdcommercial.com', role: 'staff', branch: 'BW Atlantic', position: 'Welfare Officer' },
  { name: 'Soyeb Shaikh', email: 'soyeb.shaikh@sdcommercial.com', role: 'manager', branch: 'BW Atlantic', position: 'Housing Manager' },

  // Clacton Pier Avenue (10)
  { name: 'Abdul Wuni', email: 'abdul.wuni@sdcommercial.com', role: 'staff', branch: 'Clacton Pier Avenue', position: 'Housing Officer' },
  { name: 'Chinaemerem Igwebuike', email: 'chinaemerem.igwebuike@sdcommercial.com', role: 'staff', branch: 'Clacton Pier Avenue', position: 'Housing Officer' },
  { name: 'Emeka Opara', email: 'emeka.opara@sdcommercial.com', role: 'staff', branch: 'Clacton Pier Avenue', position: 'Housing Officer' },
  { name: 'Frank Nsima', email: 'frank.nsima@sdcommercial.com', role: 'staff', branch: 'Clacton Pier Avenue', position: 'Housing Officer' },
  { name: 'Hannah Barker', email: 'hannah.barker@sdcommercial.com', role: 'staff', branch: 'Clacton Pier Avenue', position: 'Housing Officer' },
  { name: 'Md Momin Shah', email: 'md.shah@sdcommercial.com', role: 'staff', branch: 'Clacton Pier Avenue', position: 'Housing Officer' },
  { name: 'Mohammad Tahir', email: 'mohammad.tahir@sdcommercial.com', role: 'staff', branch: 'Clacton Pier Avenue' },
  { name: 'Pramodh Puppala', email: 'pramodh.puppala@sdcommercial.com', role: 'staff', branch: 'Clacton Pier Avenue', position: 'Catering Assistant' },
  { name: 'Radwa Abouzied', email: 'radwa.abouzied@sdcommercial.com', role: 'staff', branch: 'Clacton Pier Avenue', position: 'Welfare Officer' },
  { name: 'Swetha Kairamkonda', email: 'swetha.kairamkonda@sdcommercial.com', role: 'staff', branch: 'Clacton Pier Avenue', position: 'Housing Officer' },

  // Dudley Hotel (6)
  { name: 'Abdul Rahman Sheik Allavudeen', email: 'abdul.allavudeen@sdcommercial.com', role: 'staff', branch: 'Dudley Hotel', position: 'Housing Officer' },
  { name: 'Kavya Sirisetty', email: 'kavya.sirisetty@sdcommercial.com', role: 'manager', branch: 'Dudley Hotel', position: 'Housing Manager' },
  { name: 'Mathiyarasi Saravanan', email: 'mathiyarasi.saravanan@sdcommercial.com', role: 'staff', branch: 'Dudley Hotel', position: 'Housing Officer' },
  { name: 'Ratna Vallabhaneni', email: 'ratna.vallabhaneni@sdcommercial.com', role: 'staff', branch: 'Dudley Hotel', position: 'House Officer' },
  { name: 'Sri Gurugubelli', email: 'sri.gurugubelli@sdcommercial.com', role: 'staff', branch: 'Dudley Hotel', position: 'Housing Officer' },
  { name: 'Venkatnaga Edupuganti', email: 'venkatnaga.edupuganti@sdcommercial.com', role: 'staff', branch: 'Dudley Hotel', position: 'House Officer' },

  // Engagement Team (1)
  { name: 'Pamela McPherson', email: 'pamela.mcpherson@sdcommercial.com', role: 'staff', branch: 'Engagement Team', position: 'Spiritual & Pastoral Officer' },

  // Field Operations (2)
  { name: 'Alexandra Tarcau', email: 'alexandra.tarcau@sdcommercial.com', role: 'manager', branch: 'Field Operations', position: 'Area Manager' },
  { name: 'Sarru Swanni', email: 'sarru.swanni@sdcommercial.com', role: 'manager', branch: 'Field Operations', position: 'Regional Manager' },

  // Finance (2)
  { name: 'Khazima Khazima', email: 'khazima.khazima@sdcommercial.com', role: 'staff', branch: 'Finance', position: 'Finance' },
  { name: 'Naga Dodda', email: 'naga.dodda@sdcommercial.com', role: 'staff', branch: 'Finance', position: 'Finance Officer' },

  // Hilton Hampton Ealing (20)
  { name: 'Anand Kalapala', email: 'anand.kalapala@sdcommercial.com', role: 'staff', branch: 'Hilton Hampton Ealing', position: 'Housing Officer' },
  { name: 'Anvesh Alla', email: 'anvesh.alla@sdcommercial.com', role: 'staff', branch: 'Hilton Hampton Ealing', position: 'Housing Officer' },
  { name: 'Aswani Sontineni', email: 'aswani.sontineni@sdcommercial.com', role: 'staff', branch: 'Hilton Hampton Ealing', position: 'Housing Officer' },
  { name: 'Divya Katragadda', email: 'divya.katragadda@sdcommercial.com', role: 'staff', branch: 'Hilton Hampton Ealing', position: 'Housing Officer' },
  { name: 'Gowtham Chalapati', email: 'gowtham.chalapati@sdcommercial.com', role: 'staff', branch: 'Hilton Hampton Ealing', position: 'Housing Officer' },
  { name: 'Jahnavi Kolli', email: 'jahnavi.kolli@sdcommercial.com', role: 'staff', branch: 'Hilton Hampton Ealing', position: 'Housing Officer' },
  { name: 'Khaja Ahmed', email: 'khaja.ahmed@sdcommercial.com', role: 'staff', branch: 'Hilton Hampton Ealing', position: 'Housing Officer' },
  { name: 'Krishna Rama Mohan Kandula', email: 'krishna.kandula@sdcommercial.com', role: 'staff', branch: 'Hilton Hampton Ealing', position: 'Housing Officer' },
  { name: 'Manikantha Kamma', email: 'manikantha.kamma@sdcommercial.com', role: 'staff', branch: 'Hilton Hampton Ealing', position: 'Housing Officer' },
  { name: 'MD Shakhawat Hossain Sakil', email: 'md.sakil@sdcommercial.com', role: 'staff', branch: 'Hilton Hampton Ealing', position: 'Housing Officer' },
  { name: 'Mohamud Mohamud', email: 'mohamud.mohamud@sdcommercial.com', role: 'staff', branch: 'Hilton Hampton Ealing', position: 'Housing Officer' },
  { name: 'Omair Zeb', email: 'omair.zeb@sdcommercial.com', role: 'manager', branch: 'Hilton Hampton Ealing', position: 'Housing Manager' },
  { name: 'Reagan Coelho', email: 'reagan.coelho@sdcommercial.com', role: 'staff', branch: 'Hilton Hampton Ealing', position: 'Housing Officer' },
  { name: 'Rhea Fernandes', email: 'rhea.fernandes@sdcommercial.com', role: 'staff', branch: 'Hilton Hampton Ealing', position: 'Housing Officer' },
  { name: 'Sainitish Edupuganti', email: 'sainitish.edupuganti@sdcommercial.com', role: 'staff', branch: 'Hilton Hampton Ealing', position: 'Housing Officer' },
  { name: 'Satish Yarra', email: 'satish.yarra@sdcommercial.com', role: 'staff', branch: 'Hilton Hampton Ealing', position: 'Housing Officer' },
  { name: 'Shane De Araujo', email: 'shane.dearaujo@sdcommercial.com', role: 'staff', branch: 'Hilton Hampton Ealing', position: 'Housing Officer' },
  { name: 'Sudheer Kadiyala', email: 'sudheer.kadiyala@sdcommercial.com', role: 'staff', branch: 'Hilton Hampton Ealing', position: 'Housing Officer' },
  { name: 'Venkatapraveen Gonela', email: 'venkatapraveen.gonela@sdcommercial.com', role: 'staff', branch: 'Hilton Hampton Ealing', position: 'Housing Officer' },
  { name: 'Yashaswini Dara', email: 'yashaswini.dara@sdcommercial.com', role: 'staff', branch: 'Hilton Hampton Ealing', position: 'Housing Officer' },

  // Holiday Inn Express Lambeth (15)
  { name: 'Abdul Kalam Arikady', email: 'abdul.arikady@sdcommercial.com', role: 'staff', branch: 'Holiday Inn Express Lambeth', position: 'Night House Officer' },
  { name: 'Bhanu Jammula', email: 'bhanu.jammula@sdcommercial.com', role: 'staff', branch: 'Holiday Inn Express Lambeth', position: 'Housing Officer' },
  { name: 'Fathimath Mehroofa', email: 'fathimath.mehroofa@sdcommercial.com', role: 'staff', branch: 'Holiday Inn Express Lambeth', position: 'Housing Officer' },
  { name: 'Geeta Battini', email: 'geeta.battini@sdcommercial.com', role: 'staff', branch: 'Holiday Inn Express Lambeth', position: 'House Officer' },
  { name: 'Gurunath Reddy Rakasi', email: 'gurunath.rakasi@sdcommercial.com', role: 'staff', branch: 'Holiday Inn Express Lambeth', position: 'Housing Officer' },
  { name: 'Hemanth Dasari', email: 'hemanth.dasari@sdcommercial.com', role: 'staff', branch: 'Holiday Inn Express Lambeth', position: 'Housing Officer' },
  { name: 'Imran Molla', email: 'imran.molla@sdcommercial.com', role: 'staff', branch: 'Holiday Inn Express Lambeth', position: 'House Officer' },
  { name: 'Kiddy Romeo Kidasa', email: 'kiddy.kidasa@sdcommercial.com', role: 'staff', branch: 'Holiday Inn Express Lambeth', position: 'Guest Experience Night Supervisor' },
  { name: 'Mohammed Mateenuddin', email: 'mohammed.mateenuddin@sdcommercial.com', role: 'staff', branch: 'Holiday Inn Express Lambeth', position: 'Housing Officer' },
  { name: 'Muhammed Mufeed Mustafa', email: 'muhammed.mustafa@sdcommercial.com', role: 'staff', branch: 'Holiday Inn Express Lambeth', position: 'Housing Officer' },
  { name: 'Pratyusha Bandela', email: 'pratyusha.bandela@sdcommercial.com', role: 'staff', branch: 'Holiday Inn Express Lambeth', position: 'Housing Officer' },
  { name: 'Shaker Mohammed', email: 'shaker.mohammed@sdcommercial.com', role: 'staff', branch: 'Holiday Inn Express Lambeth', position: 'Housing Officer' },
  { name: 'Smriti Srivastava', email: 'smriti.srivastava@sdcommercial.com', role: 'manager', branch: 'Holiday Inn Express Lambeth', position: 'General Manager' },
  { name: 'Tarun Atheli', email: 'tarun.atheli@sdcommercial.com', role: 'staff', branch: 'Holiday Inn Express Lambeth', position: 'Housing Officer' },
  { name: 'Vinuthna Malreddy', email: 'vinuthna.malreddy@sdcommercial.com', role: 'staff', branch: 'Holiday Inn Express Lambeth', position: 'Housing Officer' },

  // Holiday Inn Old Street (19)
  { name: 'Azharuddin Mohhammed', email: 'azharuddin.mohhammed@sdcommercial.com', role: 'staff', branch: 'Holiday Inn Old Street', position: 'Housing Officer' },
  { name: 'Bhavana Sadamastula', email: 'bhavana.sadamastula@sdcommercial.com', role: 'staff', branch: 'Holiday Inn Old Street', position: 'Housing Officer' },
  { name: 'Hassan Mohiuddin Farooqui Mohammed', email: 'hassan.mohammed@sdcommercial.com', role: 'staff', branch: 'Holiday Inn Old Street', position: 'Housing Officer' },
  { name: 'Ishmam Gani', email: 'ishmam.gani@sdcommercial.com', role: 'staff', branch: 'Holiday Inn Old Street', position: 'Housing Officer' },
  { name: 'Karthik Sampathirao', email: 'karthik.sampathirao@sdcommercial.com', role: 'staff', branch: 'Holiday Inn Old Street', position: 'Housing Officer' },
  { name: 'Mohamed Salim Keedakkat', email: 'mohamed.keedakkat@sdcommercial.com', role: 'staff', branch: 'Holiday Inn Old Street', position: 'Housing Officer' },
  { name: 'Parana Mahasook', email: 'parana.mahasook@sdcommercial.com', role: 'staff', branch: 'Holiday Inn Old Street', position: 'Housing Officer' },
  { name: 'Ryan Kakkar', email: 'ryan.kakkar@sdcommercial.com', role: 'staff', branch: 'Holiday Inn Old Street', position: 'Housing Officer' },
  { name: 'Sakshi Salaria', email: 'sakshi.salaria@sdcommercial.com', role: 'staff', branch: 'Holiday Inn Old Street', position: 'Guest Experience Day Supervisor' },
  { name: 'Salman Safdar', email: 'salman.safdar@sdcommercial.com', role: 'staff', branch: 'Holiday Inn Old Street', position: 'Housing Officer' },
  { name: 'Sandro Desole', email: 'sandro.desole@sdcommercial.com', role: 'manager', branch: 'Holiday Inn Old Street', position: 'Housing Manager' },
  { name: 'Sirisha Tirumala', email: 'sirisha.tirumala@sdcommercial.com', role: 'staff', branch: 'Holiday Inn Old Street', position: 'Housing Officer' },
  { name: 'Srikanth Poshala', email: 'srikanth.poshala@sdcommercial.com', role: 'staff', branch: 'Holiday Inn Old Street', position: 'Housing Officer' },
  { name: 'Syed Saifuddin', email: 'syed.saifuddin@sdcommercial.com', role: 'staff', branch: 'Holiday Inn Old Street', position: 'Housing Officer' },
  { name: 'Uday Grover', email: 'uday.grover@sdcommercial.com', role: 'staff', branch: 'Holiday Inn Old Street', position: 'Housing Officer' },
  { name: 'Vaishnavi Chatla', email: 'vaishnavi.chatla@sdcommercial.com', role: 'staff', branch: 'Holiday Inn Old Street', position: 'Housing Officer' },
  { name: 'Viswanadh Pasumarthi', email: 'viswanadh.pasumarthi@sdcommercial.com', role: 'staff', branch: 'Holiday Inn Old Street', position: 'Housing Officer' },
  { name: 'Zarar Mohammed', email: 'zarar.mohammed@sdcommercial.com', role: 'staff', branch: 'Holiday Inn Old Street', position: 'Housing Officer' },
  { name: 'Zeeshan Sabry', email: 'zeeshan.sabry@sdcommercial.com', role: 'staff', branch: 'Holiday Inn Old Street', position: 'Housing Officer' },

  // Holiday Inn Swiss Cottage (12)
  { name: 'Abdul Ashraf', email: 'abdul.ashraf@sdcommercial.com', role: 'staff', branch: 'Holiday Inn Swiss Cottage', position: 'House Officer' },
  { name: 'Abdul Thanveen', email: 'abdul.thanveen@sdcommercial.com', role: 'staff', branch: 'Holiday Inn Swiss Cottage', position: 'Housing Officer' },
  { name: 'Abdul Majeed Mohammed', email: 'abdul.majeed@sdcommercial.com', role: 'manager', branch: 'Holiday Inn Swiss Cottage', position: 'Housing Manager' },
  { name: 'Abdul Malik Mohammed', email: 'abdul.malik@sdcommercial.com', role: 'staff', branch: 'Holiday Inn Swiss Cottage', position: 'Housing Officer' },
  { name: 'Catalina Vasilachi', email: 'catalina.vasilachi@sdcommercial.com', role: 'staff', branch: 'Holiday Inn Swiss Cottage', position: 'Guest Experience Day Supervisor' },
  { name: 'Gopi Linganti', email: 'gopi.linganti@sdcommercial.com', role: 'staff', branch: 'Holiday Inn Swiss Cottage', position: 'Housing Officer' },
  { name: 'Khushbu Patel', email: 'khushbu.patel@sdcommercial.com', role: 'staff', branch: 'Holiday Inn Swiss Cottage', position: 'House Officer' },
  { name: 'Manikanteswara Chaganti', email: 'manikanteswara.chaganti@sdcommercial.com', role: 'staff', branch: 'Holiday Inn Swiss Cottage', position: 'Housing Officer' },
  { name: 'Mohammed Ashif Abdulla', email: 'mohammed.abdulla@sdcommercial.com', role: 'staff', branch: 'Holiday Inn Swiss Cottage', position: 'Housing Officer' },
  { name: 'Reshma Thomas', email: 'reshma.thomas@sdcommercial.com', role: 'staff', branch: 'Holiday Inn Swiss Cottage', position: 'Housing Officer' },
  { name: 'Sushanth Kommula', email: 'sushanth.kommula@sdcommercial.com', role: 'staff', branch: 'Holiday Inn Swiss Cottage', position: 'House Officer' },
  { name: 'Vaidehi Goswami', email: 'vaidehi.goswami@sdcommercial.com', role: 'staff', branch: 'Holiday Inn Swiss Cottage', position: 'House Officer' },

  // IBIS Budget Bishops Stortford (10)
  { name: 'Ashish Koppela', email: 'ashish.koppela@sdcommercial.com', role: 'staff', branch: 'IBIS Budget Bishops Stortford', position: 'House Officer' },
  { name: 'Bhargav Yaladandi', email: 'bhargav.yaladandi@sdcommercial.com', role: 'staff', branch: 'IBIS Budget Bishops Stortford', position: 'House Officer' },
  { name: 'Gayathri Naga Sudha Immadi', email: 'gayathri.immadi@sdcommercial.com', role: 'staff', branch: 'IBIS Budget Bishops Stortford', position: 'Welfare/Housing Officer' },
  { name: 'Mohan Bakkanolla', email: 'mohan.bakkanolla@sdcommercial.com', role: 'staff', branch: 'IBIS Budget Bishops Stortford', position: 'House Officer' },
  { name: 'Pravalika Surampudi', email: 'pravalika.surampudi@sdcommercial.com', role: 'staff', branch: 'IBIS Budget Bishops Stortford', position: 'House Officer' },
  { name: 'Sabari Sreevalsan', email: 'sabari.sreevalsan@sdcommercial.com', role: 'staff', branch: 'IBIS Budget Bishops Stortford', position: 'House Officer' },
  { name: 'Sri Burri', email: 'sri.burri@sdcommercial.com', role: 'manager', branch: 'IBIS Budget Bishops Stortford', position: 'Housing Manager' },
  { name: 'Srikanth Mude', email: 'srikanth.mude@sdcommercial.com', role: 'staff', branch: 'IBIS Budget Bishops Stortford', position: 'House Officer' },
  { name: 'Tichafa Mlambo', email: 'tichafa.mlambo@sdcommercial.com', role: 'staff', branch: 'IBIS Budget Bishops Stortford', position: 'House Officer' },
  { name: 'Vikram Singh', email: 'vikram.singh@sdcommercial.com', role: 'staff', branch: 'IBIS Budget Bishops Stortford', position: 'House Officer' },

  // IBIS Cardiff (12)
  { name: 'Ahmed Omar Mokhtar Ba Wazir', email: 'ahmed.bawazir@sdcommercial.com', role: 'staff', branch: 'IBIS Cardiff', position: 'Housing Officer' },
  { name: 'Chamika Gamage', email: 'chamika.gamage@sdcommercial.com', role: 'staff', branch: 'IBIS Cardiff', position: 'House Officer' },
  { name: 'Charles Varshith Konda', email: 'charles.konda@sdcommercial.com', role: 'staff', branch: 'IBIS Cardiff', position: 'Housing Officer' },
  { name: 'Daniel Lankapalli', email: 'daniel.lankapalli@sdcommercial.com', role: 'staff', branch: 'IBIS Cardiff', position: 'House Officer' },
  { name: 'Govardhan Talapanti', email: 'govardhan.talapanti@sdcommercial.com', role: 'staff', branch: 'IBIS Cardiff', position: 'Housing Officer' },
  { name: 'Jayadev Gogineni', email: 'jayadev.gogineni@sdcommercial.com', role: 'staff', branch: 'IBIS Cardiff', position: 'House Officer' },
  { name: 'Maqbool Hassan', email: 'maqbool.hassan@sdcommercial.com', role: 'staff', branch: 'IBIS Cardiff', position: 'House Officer' },
  { name: 'Mounika Venuvenka', email: 'mounika.venuvenka@sdcommercial.com', role: 'staff', branch: 'IBIS Cardiff', position: 'Housing Officer' },
  { name: 'Raja Pulivarthi', email: 'raja.pulivarthi@sdcommercial.com', role: 'manager', branch: 'IBIS Cardiff', position: 'Housing Manager' },
  { name: 'Rayed Zafar', email: 'rayed.zafar@sdcommercial.com', role: 'staff', branch: 'IBIS Cardiff', position: 'Housing Officer' },
  { name: 'Sai Sriram Kudravalli', email: 'sai.kudravalli@sdcommercial.com', role: 'staff', branch: 'IBIS Cardiff', position: 'House Officer' },
  { name: 'Sreem Arla', email: 'sreem.arla@sdcommercial.com', role: 'staff', branch: 'IBIS Cardiff', position: 'House Officer' },

  // Ibis Styles Seven Kings (12)
  { name: 'Akbar Hussain Mohammed', email: 'akbar.mohammed@sdcommercial.com', role: 'staff', branch: 'Ibis Styles Seven Kings', position: 'House Officer' },
  { name: 'Anushka Sanke', email: 'anushka.sanke@sdcommercial.com', role: 'staff', branch: 'Ibis Styles Seven Kings', position: 'House Officer' },
  { name: 'Baleeghuddin Mohammed', email: 'baleeghuddin.mohammed@sdcommercial.com', role: 'staff', branch: 'Ibis Styles Seven Kings', position: 'House Officer' },
  { name: 'Deeksha Rana', email: 'deeksha.rana@sdcommercial.com', role: 'staff', branch: 'Ibis Styles Seven Kings', position: 'House Officer' },
  { name: 'Kaikasha Kaikasha', email: 'kaikasha.kaikasha@sdcommercial.com', role: 'staff', branch: 'Ibis Styles Seven Kings', position: 'House Officer' },
  { name: 'Madhukar Kummari', email: 'madhukar.kummari@sdcommercial.com', role: 'staff', branch: 'Ibis Styles Seven Kings', position: 'House Officer' },
  { name: 'Mahammed Badshah', email: 'mahammed.badshah@sdcommercial.com', role: 'staff', branch: 'Ibis Styles Seven Kings', position: 'Guest Experience Day Supervisor' },
  { name: 'Manimaran Manisekaran', email: 'manimaran.manisekaran@sdcommercial.com', role: 'staff', branch: 'Ibis Styles Seven Kings', position: 'House Officer' },
  { name: 'Mohammed Savad Manchingathodi Aboobacker', email: 'mohammed.aboobacker@sdcommercial.com', role: 'staff', branch: 'Ibis Styles Seven Kings', position: 'House Officer' },
  { name: 'Rizvan Zangharia', email: 'rizvan.zangharia@sdcommercial.com', role: 'manager', branch: 'Ibis Styles Seven Kings', position: 'Housing Manager' },
  { name: 'Samera Begum', email: 'samera.begum@sdcommercial.com', role: 'staff', branch: 'Ibis Styles Seven Kings', position: 'House Officer' },
  { name: 'Uthej Ravoori', email: 'uthej.ravoori@sdcommercial.com', role: 'staff', branch: 'Ibis Styles Seven Kings', position: 'Housing Officer' },

  // Lea Halls (12)
  { name: 'Bolanle Adebowale', email: 'bolanle.adebowale@sdcommercial.com', role: 'staff', branch: 'Lea Halls', position: 'Welfare Supervisor' },
  { name: 'Hamza Halim', email: 'hamza.halim@sdcommercial.com', role: 'staff', branch: 'Lea Halls', position: 'Housing Officer' },
  { name: 'Henry Ikenna Uzoma', email: 'henry.uzoma@sdcommercial.com', role: 'staff', branch: 'Lea Halls', position: 'Housing Officer' },
  { name: 'Mahesh Goud Palakuri', email: 'mahesh.palakuri@sdcommercial.com', role: 'staff', branch: 'Lea Halls', position: 'Housing Officer' },
  { name: 'Manoj Kumar Kandra', email: 'manoj.kandra@sdcommercial.com', role: 'staff', branch: 'Lea Halls', position: 'Housing Officer' },
  { name: 'Masthan Vali Gulam', email: 'masthan.gulam@sdcommercial.com', role: 'staff', branch: 'Lea Halls' },
  { name: 'Nagarjuna Babu Adapa', email: 'nagarjuna.adapa@sdcommercial.com', role: 'staff', branch: 'Lea Halls', position: 'Housing/Welfare Officer' },
  { name: 'Narendra Peddi', email: 'narendra.peddi@sdcommercial.com', role: 'staff', branch: 'Lea Halls' },
  { name: 'Opekitan Emmanuel Orimolade', email: 'opekitan.orimolade@sdcommercial.com', role: 'staff', branch: 'Lea Halls', position: 'Housing Officer' },
  { name: 'Prudhvi Konduru', email: 'prudhvi.konduru@sdcommercial.com', role: 'staff', branch: 'Lea Halls', position: 'Housing Officer' },
  { name: 'Sameer Saifi', email: 'sameer.saifi@sdcommercial.com', role: 'staff', branch: 'Lea Halls' },
  { name: 'Santosh Gandla', email: 'santosh.gandla@sdcommercial.com', role: 'staff', branch: 'Lea Halls', position: 'Housing Officer' },

  // Leigham Court Hotel (10)
  { name: 'Gopi Nandigam', email: 'gopi.nandigam@sdcommercial.com', role: 'staff', branch: 'Leigham Court Hotel', position: 'House Officer' },
  { name: 'Imran Mohammad', email: 'imran.mohammad@sdcommercial.com', role: 'staff', branch: 'Leigham Court Hotel', position: 'House Officer' },
  { name: 'Jordan Daniel Lubanga-Kene', email: 'jordan.lubanga@sdcommercial.com', role: 'staff', branch: 'Leigham Court Hotel', position: 'Housing Officer' },
  { name: 'Kumara Swamy Vattikoti', email: 'kumara.vattikoti@sdcommercial.com', role: 'staff', branch: 'Leigham Court Hotel', position: 'House Officer' },
  { name: 'Rafaela Azevedo Caeiro', email: 'rafaela.caeiro@sdcommercial.com', role: 'staff', branch: 'Leigham Court Hotel', position: 'House Officer' },
  { name: 'Sai Krishna Thota', email: 'sai.thota@sdcommercial.com', role: 'staff', branch: 'Leigham Court Hotel' },
  { name: 'Taqiuddin Mohammad', email: 'taqiuddin.mohammad@sdcommercial.com', role: 'staff', branch: 'Leigham Court Hotel', position: 'House Officer' },
  { name: 'Vaishnavi Bolneni', email: 'vaishnavi.bolneni@sdcommercial.com', role: 'staff', branch: 'Leigham Court Hotel', position: 'Housing Officer' },
  { name: 'Vinodhan Rowththeavar Vairakannu', email: 'vinodhan.vairakannu@sdcommercial.com', role: 'staff', branch: 'Leigham Court Hotel', position: 'House Officer' },
  { name: 'Yugeshwer Kallu', email: 'yugeshwer.kallu@sdcommercial.com', role: 'staff', branch: 'Leigham Court Hotel', position: 'House Officer' },

  // Maida Vale Apart Hotel (8)
  { name: 'Ahmad Kothia', email: 'ahmad.kothia@sdcommercial.com', role: 'staff', branch: 'Maida Vale Apart Hotel', position: 'Housing Officer' },
  { name: 'Harshita Soni', email: 'harshita.soni@sdcommercial.com', role: 'staff', branch: 'Maida Vale Apart Hotel', position: 'Housing Officer' },
  { name: 'Ibrahim Musthafa', email: 'ibrahim.musthafa@sdcommercial.com', role: 'manager', branch: 'Maida Vale Apart Hotel', position: 'Housing Manager' },
  { name: 'Ibrahim Shanfar', email: 'ibrahim.shanfar@sdcommercial.com', role: 'staff', branch: 'Maida Vale Apart Hotel', position: 'Housing Officer' },
  { name: 'Kalyan Teja Uppalapati', email: 'kalyan.uppalapati@sdcommercial.com', role: 'staff', branch: 'Maida Vale Apart Hotel', position: 'Housing Officer' },
  { name: 'Mohammed Anas Moilar Abdulkhader', email: 'mohammed.moilar@sdcommercial.com', role: 'staff', branch: 'Maida Vale Apart Hotel', position: 'Housing Officer' },
  { name: 'Sangameswaran Jayaraman', email: 'sangameswaran.jayaraman@sdcommercial.com', role: 'staff', branch: 'Maida Vale Apart Hotel', position: 'Housing Officer' },
  { name: 'Sathish Veeramachaneni', email: 'sathish.veeramachaneni@sdcommercial.com', role: 'staff', branch: 'Maida Vale Apart Hotel', position: 'Housing Officer' },

  // Mercure Heathrow (9)
  { name: 'Hamza Ejaz', email: 'hamza.ejaz@sdcommercial.com', role: 'staff', branch: 'Mercure Heathrow', position: 'Housing Officer' },
  { name: 'Madan Mandula', email: 'madan.mandula@sdcommercial.com', role: 'staff', branch: 'Mercure Heathrow', position: 'Housing Officer' },
  { name: 'Melik Aouididi', email: 'melik.aouididi@sdcommercial.com', role: 'staff', branch: 'Mercure Heathrow', position: 'Housing Officer' },
  { name: 'Mohammad Arslan', email: 'mohammad.arslan@sdcommercial.com', role: 'staff', branch: 'Mercure Heathrow', position: 'Housing Officer' },
  { name: 'Muatsim Khan', email: 'muatsim.khan@sdcommercial.com', role: 'staff', branch: 'Mercure Heathrow', position: 'Housing Officer' },
  { name: 'Obaid Ur Rehman', email: 'obaid.rehman@sdcommercial.com', role: 'staff', branch: 'Mercure Heathrow', position: 'Housing Officer' },
  { name: 'Praveen Yellappagari', email: 'praveen.yellappagari@sdcommercial.com', role: 'staff', branch: 'Mercure Heathrow', position: 'Housing Officer' },
  { name: 'Steve Minor', email: 'steve.minor@sdcommercial.com', role: 'staff', branch: 'Mercure Heathrow', position: 'Housing Officer' },
  { name: 'Thomas Clifton', email: 'thomas.clifton@sdcommercial.com', role: 'staff', branch: 'Mercure Heathrow' },

  // Parmiter (10)
  { name: 'Boby Hazra', email: 'boby.hazra@sdcommercial.com', role: 'staff', branch: 'Parmiter', position: 'Housing Officer' },
  { name: 'Chandralekha Veerath', email: 'chandralekha.veerath@sdcommercial.com', role: 'staff', branch: 'Parmiter', position: 'Housing Officer' },
  { name: 'Dushant Banga', email: 'dushant.banga@sdcommercial.com', role: 'staff', branch: 'Parmiter', position: 'Housing Officer' },
  { name: 'Gangadhara Janardhana Chaitanya Dasari', email: 'gangadhara.dasari@sdcommercial.com', role: 'staff', branch: 'Parmiter', position: 'Housing Officer' },
  { name: 'Ibrahim Qureshi Mohammed', email: 'ibrahim.qureshi@sdcommercial.com', role: 'staff', branch: 'Parmiter', position: 'Housing Officer' },
  { name: 'Roshan Ravipati', email: 'roshan.ravipati@sdcommercial.com', role: 'staff', branch: 'Parmiter', position: 'Housing Officer' },
  { name: 'Sai Katram', email: 'sai.katram@sdcommercial.com', role: 'staff', branch: 'Parmiter', position: 'Housing Officer' },
  { name: 'Shaikh Asif', email: 'shaikh.asif@sdcommercial.com', role: 'manager', branch: 'Parmiter', position: 'Housing Manager' },
  { name: 'Srikanth Bathini', email: 'srikanth.bathini@sdcommercial.com', role: 'staff', branch: 'Parmiter', position: 'Housing Officer' },
  { name: 'Venkata Hemanth Gangireddy', email: 'venkata.gangireddy@sdcommercial.com', role: 'staff', branch: 'Parmiter', position: 'Housing Officer' },

  // No team employees
  { name: 'Daniel Dixon-Bush', email: 'daniel.dixon@sdcommercial.com', role: 'staff', branch: 'Head Office', position: 'Housing Officer' },
  { name: 'Test Test', email: 'test.test@sdcommercial.com', role: 'staff', branch: 'Head Office', position: 'Housing Officer' },
];

const DEFAULT_PASSWORD = '123456';

async function addAllData() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Add all branches to properties table
    console.log('\n🏢 Adding branches to properties table...\n');
    let propCount = 0;
    
    for (const branch of branches) {
      try {
        const existing = await client.query(
          'SELECT id FROM properties WHERE name = $1',
          [branch.name]
        );
        
        if (existing.rows.length === 0) {
          const result = await client.query(
            `INSERT INTO properties (name, code, created_at, updated_at)
             VALUES ($1, $2, NOW(), NOW())
             RETURNING id`,
            [branch.name, branch.code]
          );
          console.log(`  ✅ Added property: ${branch.name} (${branch.code})`);
          propCount++;
        } else {
          console.log(`  ⏭️  Property exists: ${branch.name}`);
        }
      } catch (err) {
        console.error(`  ❌ Error adding ${branch.name}:`, err.message);
      }
    }
    
    // Add all employees to users table
    console.log(`\n👥 Adding ${employees.length} employees to users table...\n`);
    const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);
    let empSuccess = 0;
    let empSkip = 0;
    let empError = 0;
    
    for (const emp of employees) {
      try {
        const existing = await client.query(
          'SELECT id FROM users WHERE email = $1',
          [emp.email]
        );
        
        if (existing.rows.length > 0) {
          empSkip++;
          continue;
        }
        
        await client.query(
          `INSERT INTO users 
           (name, email, password, role, branch, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, 'active', NOW(), NOW())`,
          [emp.name, emp.email, hashedPassword, emp.role, emp.branch]
        );
        
        empSuccess++;
        if (empSuccess % 20 === 0) {
          console.log(`  ✅ Processed ${empSuccess} employees...`);
        }
      } catch (err) {
        console.error(`  ❌ Error adding ${emp.name}:`, err.message);
        empError++;
      }
    }
    
    await client.query('COMMIT');
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 FINAL SUMMARY:');
    console.log('='.repeat(80));
    console.log(`  🏢 Properties: ${propCount} added`);
    console.log(`  👥 Employees: ${empSuccess} added, ${empSkip} skipped, ${empError} errors`);
    console.log(`  📝 Total employees processed: ${employees.length}`);
    console.log('='.repeat(80));
    
    if (empSuccess > 0) {
      console.log(`\n🔑 Default password for all new employees: ${DEFAULT_PASSWORD}`);
      console.log('⚠️  All employees should change their password on first login\n');
    }
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Transaction rolled back:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

console.log('\n' + '='.repeat(80));
console.log('🚀 BULK IMPORT: EMPLOYEES & BRANCHES');
console.log('='.repeat(80));
console.log(`📋 Branches to add: ${branches.length}`);
console.log(`👥 Employees to add: ${employees.length}`);
console.log('='.repeat(80));

addAllData().catch(error => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});
