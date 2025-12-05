// TheRoofDocs Employee Data for Bulk Import
// Generated: December 5, 2025
// Total: 128 employees (duplicates removed)

export interface EmployeeData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  position: string;
  department: string;
}

// Role mapping function
export function mapRoleToSystem(position: string): string {
  const posLower = position.toLowerCase();
  if (posLower === 'admin') return 'ADMIN';
  if (posLower === 'sales manager') return 'TERRITORY_SALES_MANAGER';
  if (['ops manager', 'hr director', 'production manager'].includes(posLower)) return 'MANAGER';
  if (posLower === 'sales rep') return 'SALES_REP';
  if (posLower === 'field tech') return 'FIELD_TECH';
  // Field Trainer, Estimator, Project Manager, Project Coordinator, Ops Assistant -> EMPLOYEE
  return 'EMPLOYEE';
}

// Department mapping based on position
export function getDepartment(position: string): string {
  const posLower = position.toLowerCase();
  if (posLower.includes('admin')) return 'Administration';
  if (posLower.includes('sales')) return 'Sales';
  if (posLower.includes('ops')) return 'Operations';
  if (posLower.includes('hr')) return 'Human Resources';
  if (posLower.includes('production')) return 'Production';
  if (posLower.includes('field')) return 'Field Operations';
  if (posLower.includes('estimator')) return 'Estimating';
  if (posLower.includes('project')) return 'Project Management';
  return 'General';
}

export const theRoofDocsEmployees: EmployeeData[] = [
  // ===== ADMIN (7) =====
  { firstName: 'Mike', lastName: 'Rafter', email: 'mike.rafter@theroofdocs.com', phone: '(703) 239-3769', position: 'Admin', department: 'Administration' },
  { firstName: 'Mike', lastName: 'Harvey', email: 'admin@theroofdocs.com', phone: '(717) 476-8998', position: 'Admin', department: 'Administration' },
  { firstName: 'Ford', lastName: 'Barsi', email: 'ford.barsi@theroofdocs.com', phone: '(240) 354-6718', position: 'Admin', department: 'Administration' },
  { firstName: 'Chris', lastName: 'Davis', email: 'developer@theroofdocs.com', phone: '(717) 451-2083', position: 'Admin', department: 'Administration' },
  { firstName: 'Oliver', lastName: 'Brown', email: 'oliver.brown@theroofdocs.com', phone: '(703) 375-9618', position: 'Admin', department: 'Administration' },
  { firstName: 'Steve', lastName: 'Evrard', email: 'stevelevrard@gmail.com', phone: null, position: 'Admin', department: 'Administration' },
  { firstName: 'Info', lastName: 'TheRoofDocs', email: 'info@theroofdocs.com', phone: '(703) 786-5789', position: 'Admin', department: 'Administration' },

  // ===== SALES MANAGER (1) =====
  { firstName: 'Bruno', lastName: 'Nacipucha', email: 'bruno.n@theroofdocs.com', phone: '(703) 239-3123', position: 'Sales Manager', department: 'Sales' },

  // ===== OPS MANAGERS (12) =====
  { firstName: 'Sima', lastName: 'Popal', email: 'sima.popal@theroofdocs.com', phone: null, position: 'Ops Manager', department: 'Operations' },
  { firstName: 'Brandon', lastName: 'Pernot', email: 'brandon.pernot@theroofdocs.com', phone: '(703) 239-3705', position: 'Ops Manager', department: 'Operations' },
  { firstName: 'Keith', lastName: 'Ziemba', email: 'keith.ziemba@theroofdocs.com', phone: '(703) 239-3809', position: 'Ops Manager', department: 'Operations' },
  { firstName: 'Brian', lastName: 'Geoffrion', email: 'brian.geoffrion@theroofdocs.com', phone: '(703) 239-3013', position: 'Ops Manager', department: 'Operations' },
  { firstName: 'Star', lastName: 'Mackey', email: 'star.mackey@theroofdocs.com', phone: '(703) 239-3033', position: 'Ops Manager', department: 'Operations' },
  { firstName: 'Alex', lastName: 'Ortega', email: 'alex.ortega@theroofdocs.com', phone: '(617) 780-1666', position: 'Ops Manager', department: 'Operations' },
  { firstName: 'Jeremy', lastName: 'Hayden', email: 'jeremy.hayden@theroofdocs.com', phone: '(703) 239-3802', position: 'Ops Manager', department: 'Operations' },
  { firstName: 'Reese', lastName: 'Samala', email: 'reese.samala@theroofdocs.com', phone: '(703) 239-3085', position: 'Ops Manager', department: 'Operations' },
  { firstName: 'Ahmed', lastName: 'Mahmoud', email: 'ahmed.mahmoud@theroofdocs.com', phone: '(703) 239-3629', position: 'Ops Manager', department: 'Operations' },
  { firstName: 'Jay', lastName: 'Waseem', email: 'jay@theroofdocs.com', phone: '(703) 493-0114', position: 'Ops Manager', department: 'Operations' },
  { firstName: 'Patrick', lastName: 'Robertson', email: 'patrick.robertson@theroofdocs.com', phone: '(703) 249-9453', position: 'Ops Manager', department: 'Operations' },

  // ===== OPS ASSISTANTS (2) =====
  { firstName: 'Jermaine', lastName: 'Perkins', email: 'support@theroofdocs.com', phone: '(703) 239-3590', position: 'Ops Assistant', department: 'Operations' },
  { firstName: 'Varun', lastName: 'Solan', email: 'varun@theroofdocs.com', phone: '(617) 417-1809', position: 'Ops Assistant', department: 'Operations' },

  // ===== HR DIRECTORS (2) =====
  { firstName: 'Ryan', lastName: 'Ferguson', email: 'careers@theroofdocs.com', phone: '(703) 239-3222', position: 'HR Director', department: 'Human Resources' },
  { firstName: 'Tim', lastName: 'Danelle', email: 'jobs@theroofdocs.com', phone: '(703) 239-3097', position: 'HR Director', department: 'Human Resources' },

  // ===== PRODUCTION MANAGERS (4) =====
  { firstName: 'Evan', lastName: 'Ruszala', email: 'service@theroofdocs.com', phone: '(703) 239-4479', position: 'Production Manager', department: 'Production' },
  { firstName: 'Jack', lastName: 'Strycharz', email: 'jack@theroofdocs.com', phone: '(571) 377-9500', position: 'Production Manager', department: 'Production' },
  { firstName: 'Greg', lastName: 'Campbell', email: 'greg.campbell@theroofdocs.com', phone: '(703) 232-9169', position: 'Production Manager', department: 'Production' },
  { firstName: 'Rhett', lastName: 'Thomas', email: 'rhett@theroofdocs.com', phone: '(703) 239-3573', position: 'Production Manager', department: 'Production' },

  // ===== FIELD TECHS (3) =====
  { firstName: 'Francisco', lastName: 'Toro', email: 'francisco.toro@theroofdocs.com', phone: '(703) 712-2019', position: 'Field Tech', department: 'Field Operations' },
  { firstName: 'Michael', lastName: 'Murtha', email: 'michael.murtha@theroofdocs.com', phone: '(610) 479-2464', position: 'Field Tech', department: 'Field Operations' },
  { firstName: 'Ismael', lastName: 'Coreas', email: 'ismael.coreas@theroofdocs.com', phone: '(703) 559-1443', position: 'Field Tech', department: 'Field Operations' },

  // ===== ESTIMATORS (3) =====
  { firstName: 'Steven', lastName: 'Saravia', email: 'steven@theroofdocs.com', phone: '(703) 436-2721', position: 'Estimator', department: 'Estimating' },
  { firstName: 'Amber', lastName: 'Couch', email: 'estimates@theroofdocs.com', phone: '(703) 239-3014', position: 'Estimator', department: 'Estimating' },
  { firstName: 'Danny', lastName: 'Ticktin', email: 'danny.ticktin@theroofdocs.com', phone: '(703) 239-3095', position: 'Estimator', department: 'Estimating' },

  // ===== PROJECT MANAGERS (3) =====
  { firstName: 'Cadell', lastName: 'Barnes', email: 'cadell.barnes@theroofdocs.com', phone: '(804) 393-0634', position: 'Project Manager', department: 'Project Management' },
  { firstName: 'Matt', lastName: 'Fletcher', email: 'matt.fletcher@theroofdocs.com', phone: '(703) 249-9652', position: 'Project Manager', department: 'Project Management' },
  { firstName: 'Jose', lastName: 'Rodriguez', email: 'jose@theroofdocs.com', phone: '703-249-9824', position: 'Project Manager', department: 'Project Management' },

  // ===== PROJECT COORDINATORS (11) =====
  { firstName: 'Ramon', lastName: 'Mastrogiuseppe', email: 'ramon@theroofdocs.com', phone: '(703) 239-4496', position: 'Project Coordinator', department: 'Project Management' },
  { firstName: 'Mitchell', lastName: 'St. Louis', email: 'mitchell@theroofdocs.com', phone: '(267) 217-3432', position: 'Project Coordinator', department: 'Project Management' },
  { firstName: 'Matthew', lastName: 'Bothner', email: 'matt.bothner@theroofdocs.com', phone: '(703) 261-4195', position: 'Project Coordinator', department: 'Project Management' },
  { firstName: 'Ignacio', lastName: 'Paz', email: 'ignacio.paz@theroofdocs.com', phone: '(703) 239-3616', position: 'Project Coordinator', department: 'Project Management' },
  { firstName: 'Michael', lastName: 'Landrum', email: 'michael.landrum@theroofdocs.com', phone: '(703) 239-4617', position: 'Project Coordinator', department: 'Project Management' },
  { firstName: 'Edmund', lastName: "O'Brien", email: 'edmund.obrien@theroofdocs.com', phone: '(270) 839-4971', position: 'Project Coordinator', department: 'Project Management' },
  { firstName: 'Peter', lastName: 'Feeney', email: 'peter.feeney@theroofdocs.com', phone: '(703) 239-3175', position: 'Project Coordinator', department: 'Project Management' },
  { firstName: 'Matt', lastName: 'Ray', email: 'matt.ray@theroofdocs.com', phone: '(703) 239-4589', position: 'Project Coordinator', department: 'Project Management' },
  { firstName: 'Rob', lastName: 'Renzi', email: 'rob.renzi@theroofdocs.com', phone: '(703) 239-3639', position: 'Project Coordinator', department: 'Project Management' },
  { firstName: 'Fernando', lastName: 'Martinez', email: 'fernando@theroofdocs.com', phone: '(703) 239-3403', position: 'Project Coordinator', department: 'Project Management' },

  // ===== FIELD TRAINERS (10) =====
  { firstName: 'Michael', lastName: 'Swearingen', email: 'michael.swearingen@theroofdocs.com', phone: '(703) 239-3019', position: 'Field Trainer', department: 'Field Operations' },
  { firstName: 'Luis', lastName: 'Esteves', email: 'luis.esteves@theroofdocs.com', phone: '(703) 594-6802', position: 'Field Trainer', department: 'Field Operations' },
  { firstName: 'Nick', lastName: 'Bourdin', email: 'nick.bourdin@theroofdocs.com', phone: '(703) 239-3132', position: 'Field Trainer', department: 'Field Operations' },
  { firstName: 'Carlos', lastName: 'Davila', email: 'carlos.davila@theroofdocs.com', phone: '(703) 239-3173', position: 'Field Trainer', department: 'Field Operations' },
  { firstName: 'Navid', lastName: 'Javid', email: 'navid.javid@theroofdocs.com', phone: '(703) 239-3197', position: 'Field Trainer', department: 'Field Operations' },
  { firstName: 'Andre', lastName: 'Mealy', email: 'andre.mealy@theroofdocs.com', phone: '(703) 239-3371', position: 'Field Trainer', department: 'Field Operations' },
  { firstName: 'Jason', lastName: 'Brown', email: 'jason.brown@theroofdocs.com', phone: '(703) 239-3279', position: 'Field Trainer', department: 'Field Operations' },
  { firstName: 'Miguel', lastName: 'Ocampo', email: 'miguel.ocampo@theroofdocs.com', phone: '(571) 210-1424', position: 'Field Trainer', department: 'Field Operations' },
  { firstName: 'Richie', lastName: 'Riley', email: 'richie.riley@theroofdocs.com', phone: '(703) 239-3094', position: 'Field Trainer', department: 'Field Operations' },
  { firstName: 'Shane', lastName: 'Santangelo', email: 'shane.santangelo@theroofdocs.com', phone: '(703) 239-4703', position: 'Field Trainer', department: 'Field Operations' },

  // ===== SALES REPS (78 - duplicates removed) =====
  { firstName: 'Tracie', lastName: 'Phan', email: 'tracie.phan@theroofdocs.com', phone: '(703) 786-0223', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Derick', lastName: 'Bus-Peters', email: 'derick.p@theroofdocs.com', phone: '(484) 206-5124', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Antonio', lastName: 'Mota', email: 'antonio.mota@theroofdocs.com', phone: null, position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Ryan', lastName: 'Kiely', email: 'ryan.kiely@theroofdocs.com', phone: '(267) 217-3063', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Zubair', lastName: 'Habibi', email: 'zubair.h@theroofdocs.com', phone: '(703) 239-3028', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Ryan', lastName: 'Parker', email: 'ryan.parker@theroofdocs.com', phone: '(484) 222-3059', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Andrew', lastName: 'Stabile', email: 'andrew.stabile@theroofdocs.com', phone: '(202) 495-8091', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Tavon', lastName: 'Ray', email: 'tavon.r@theroofdocs.com', phone: '(703) 239-3570', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Arnulfo', lastName: 'Reyes', email: 'arnulfo.reyes@theroofdocs.com', phone: '(703) 239-3144', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Mattias', lastName: 'Kasparian', email: 'mattias.kasparian@theroofdocs.com', phone: '(703) 239-3615', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Hugo', lastName: 'Manrique-Pinell', email: 'hugo.manrique-pinell@theroofdocs.com', phone: '(703) 239-3110', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'John', lastName: 'Mohl', email: 'john.m@theroofdocs.com', phone: '(703) 239-3634', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Jonathan', lastName: 'Alquijay', email: 'jonathan.alquijay@theroofdocs.com', phone: '(703) 239-3071', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'William', lastName: 'Zumwalt', email: 'william.z@theroofdocs.com', phone: '(703) 401-4943', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Ian', lastName: 'Thrash', email: 'ian.thrash@theroofdocs.com', phone: '(703) 239-3398', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Colin', lastName: 'Koos', email: 'colin.k@theroofdocs.com', phone: '(267) 217-3139', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Michael', lastName: 'Gabriel', email: 'michael.gabriel@theroofdocs.com', phone: '(703) 323-9453', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Kristian', lastName: 'Portillo', email: 'kristian.portillo@theroofdocs.com', phone: null, position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Kieran', lastName: 'Sheehan', email: 'kieran.sheehan@theroofdocs.com', phone: '(804) 223-1769', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Daniel', lastName: 'Alonso', email: 'daniel.alonso@theroofdocs.com', phone: '(703) 239-3362', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Fady', lastName: 'Al Labbani', email: 'fady.allabbani@theroofdocs.com', phone: null, position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Daniel', lastName: 'Wang', email: 'daniel.wang@theroofdocs.com', phone: null, position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Joseph', lastName: 'Marcella', email: 'joseph.marcella@theroofdocs.com', phone: '(484) 020-6502', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Ray', lastName: 'Ren', email: 'ray.ren@theroofdocs.com', phone: '(703) 239-3231', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Jimmy', lastName: 'Brown', email: 'jimmy.brown@theroofdocs.com', phone: '(703) 239-3480', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Trevon', lastName: 'Neely', email: 'trevon.n@theroofdocs.com', phone: '(703) 239-3108', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Aryk', lastName: 'Smith', email: 'aryk.smith@theroofdocs.com', phone: '(703) 239-3477', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'David', lastName: 'Sura', email: 'david.sura@theroofdocs.com', phone: '(703) 239-4702', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Marcus', lastName: 'Vernon', email: 'marcus.vernon@theroofdocs.com', phone: '(804) 223-2673', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Daniel', lastName: 'Mitchell', email: 'daniel.mitchell@theroofdocs.com', phone: '(484) 206-5187', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Jhonatan', lastName: 'Oyola', email: 'jhonatan.oyola@theroofdocs.com', phone: null, position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Kerouls', lastName: 'Gayed', email: 'kerouls.gayed@theroofdocs.com', phone: '(804) 223-0238', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Boakye', lastName: 'Nkromah', email: 'boakye.nkromah@theroofdocs.com', phone: null, position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Han', lastName: 'D', email: 'han.d@theroofdocs.com', phone: '(804) 223-1549', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'James', lastName: 'Armel', email: 'james.armel@theroofdocs.com', phone: '(703) 239-3468', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Jonathan', lastName: 'Rivera', email: 'jonathan.r@theroofdocs.com', phone: '(703) 239-3796', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Hunter', lastName: 'Hall', email: 'hunter.hall@theroofdocs.com', phone: '(703) 239-3058', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Ibrahim', lastName: 'Sohail', email: 'ibrahim.s@theroofdocs.com', phone: '(703) 493-0138', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Elijah', lastName: 'Hicks', email: 'elijah.hicks@theroofdocs.com', phone: '(703) 239-3686', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Fabrizio', lastName: 'Gonzalez', email: 'fabrizio.gonzalez@theroofdocs.com', phone: '(703) 239-3778', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Benjamin', lastName: 'Salgado', email: 'ben.salgado@theroofdocs.com', phone: '(703) 239-3134', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Tristan', lastName: 'Emerson', email: 'tristan.e@theroofdocs.com', phone: '(703) 239-3467', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Jon', lastName: 'Meyer', email: 'jon.meyer@theroofdocs.com', phone: '(838) 200-8631', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Walid', lastName: 'Saidani', email: 'walid.s@theroofdocs.com', phone: '(703) 239-3441', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Joseph', lastName: 'Ammendola', email: 'joseph.ammendola@theroofdocs.com', phone: '(484) 206-5019', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Michael', lastName: 'Brawner', email: 'michael.brawner@theroofdocs.com', phone: '(703) 239-3381', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Abraham', lastName: 'Raz', email: 'abraham.raz@theroofdocs.com', phone: '(703) 239-3191', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Eric', lastName: 'Rickel', email: 'eric.rickel@theroofdocs.com', phone: '(484) 206-5130', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Jalen', lastName: 'Simms', email: 'jalen.s@theroofdocs.com', phone: '(703) 239-3106', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Larry', lastName: 'Hale', email: 'larry.hale@theroofdocs.com', phone: '(703) 239-4762', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Steve', lastName: 'McKim', email: 'steve.mckim@theroofdocs.com', phone: '(703) 239-3412', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Doron', lastName: 'Tauber', email: 'doron.tauber@theroofdocs.com', phone: null, position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Devin', lastName: 'Fraser', email: 'devin.fraser@theroofdocs.com', phone: '(703) 239-3419', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Ben', lastName: 'Gohh', email: 'ben.gohh@theroofdocs.com', phone: '(401) 787-4131', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Ross', lastName: 'Renzi', email: 'ross.renzi@theroofdocs.com', phone: '(703) 239-3111', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Tim', lastName: 'Kelley', email: 'tim.kelley@theroofdocs.com', phone: '(571) 419-4049', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'George', lastName: 'Gerdes', email: 'george.g@theroofdocs.com', phone: '(804) 223-2366', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Ziggy', lastName: 'Smith', email: 'ziggy.smith@theroofdocs.com', phone: null, position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Christian', lastName: 'Bratton', email: 'christian.bratton@theroofdocs.com', phone: '(703) 239-3199', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Kevin', lastName: 'Maloney', email: 'kevin.maloney@theroofdocs.com', phone: '(808) 219-5968', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Mohammed', lastName: 'Fazelyar', email: 'mo.f@theroofdocs.com', phone: '(703) 239-3129', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Colby', lastName: 'Mahlstede', email: 'colby.mahlstede@theroofdocs.com', phone: '(801) 663-1117', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Garett', lastName: 'Dunn-Ford', email: 'garrett.d@theroofdocs.com', phone: '(703) 239-3819', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Joseph', lastName: 'Boyd', email: 'joseph.boyd@theroofdocs.com', phone: '(804) 223-2167', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Avian', lastName: 'Hicks', email: 'avian.hicks@theroofdocs.com', phone: '(703) 239-3260', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Danielle', lastName: 'W', email: 'danielle.w@theroofdocs.com', phone: '(703) 239-3191', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Esteban', lastName: 'Hernandez', email: 'esteban.hernandez@theroofdocs.com', phone: null, position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Chris', lastName: 'Aycock', email: 'chris.aycock@theroofdocs.com', phone: '(703) 239-3034', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Joseph', lastName: 'Hong', email: 'joseph.hong@theroofdocs.com', phone: '(703) 239-4737', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Basel', lastName: 'Halim', email: 'basel.halim@theroofdocs.com', phone: '(703) 239-3618', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Jamal', lastName: 'Washington', email: 'jamal.washington@theroofdocs.com', phone: '(703) 239-3437', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Saumair', lastName: 'Gowani', email: 'saumair.gowani@theroofdocs.com', phone: '(804) 418-5507', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Ruben', lastName: 'Luciano', email: 'ruben.luciano@theroofdocs.com', phone: '(626) 343-3074', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Humberto', lastName: 'Berrio', email: 'humberto.berrio@theroofdocs.com', phone: '(703) 239-4478', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Truitt', lastName: 'Todd', email: 'truitt.todd@theroofdocs.com', phone: '(386) 867-5446', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Gabe', lastName: 'Long', email: 'gabe.long@theroofdocs.com', phone: '(703) 239-3446', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Eric', lastName: 'Philippeau', email: 'eric.p@theroofdocs.com', phone: '(267) 217-3202', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Mohamed', lastName: 'Abdelaty', email: 'mohamed.abdelaty@theroofdocs.com', phone: '(571) 856-4991', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Evan', lastName: 'Gonzalez', email: 'evan.g@theroofdocs.com', phone: '(703) 239-3473', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Michael', lastName: 'Mulkerin', email: 'michael.mulkerin@theroofdocs.com', phone: '(703) 239-3163', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Michael', lastName: 'Brooks', email: 'michael.brooks@theroofdocs.com', phone: '(703) 239-3565', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Niyi', lastName: 'Shomade', email: 'niyi.shomade@theroofdocs.com', phone: '(771) 444-0026', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'John', lastName: 'Walker', email: 'john.w@theroofdocs.com', phone: '(804) 214-7667', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Jose', lastName: 'Umana', email: 'jose.u@theroofdocs.com', phone: '(703) 239-3035', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Rodrigo', lastName: 'Lopez', email: 'rodrigo.lopez@theroofdocs.com', phone: '(703) 239-3239', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Martin', lastName: 'Travezano', email: 'martin.travezano@theroofdocs.com', phone: '(703) 323-9450', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Angel', lastName: 'Ardid-Balmes', email: 'angel.ardid-balmes@theroofdocs.com', phone: '(703) 239-3592', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Kyrie', lastName: 'Belk', email: 'kyrie.belk@theroofdocs.com', phone: null, position: 'Sales Rep', department: 'Sales' },
  { firstName: 'William', lastName: 'Marshall', email: 'william.marshall@theroofdocs.com', phone: '(943) 900-8556', position: 'Sales Rep', department: 'Sales' },
  { firstName: 'Brett', lastName: 'McCrane', email: 'brett.m@theroofdocs.com', phone: '(703) 239-4617', position: 'Sales Rep', department: 'Sales' },
];

// Summary stats
export const employeeStats = {
  total: theRoofDocsEmployees.length,
  byRole: {
    admin: theRoofDocsEmployees.filter(e => e.position === 'Admin').length,
    salesManager: theRoofDocsEmployees.filter(e => e.position === 'Sales Manager').length,
    opsManager: theRoofDocsEmployees.filter(e => e.position === 'Ops Manager').length,
    hrDirector: theRoofDocsEmployees.filter(e => e.position === 'HR Director').length,
    productionManager: theRoofDocsEmployees.filter(e => e.position === 'Production Manager').length,
    opsAssistant: theRoofDocsEmployees.filter(e => e.position === 'Ops Assistant').length,
    fieldTech: theRoofDocsEmployees.filter(e => e.position === 'Field Tech').length,
    fieldTrainer: theRoofDocsEmployees.filter(e => e.position === 'Field Trainer').length,
    estimator: theRoofDocsEmployees.filter(e => e.position === 'Estimator').length,
    projectManager: theRoofDocsEmployees.filter(e => e.position === 'Project Manager').length,
    projectCoordinator: theRoofDocsEmployees.filter(e => e.position === 'Project Coordinator').length,
    salesRep: theRoofDocsEmployees.filter(e => e.position === 'Sales Rep').length,
  }
};

console.log('TheRoofDocs Employee Data Loaded:', employeeStats);
