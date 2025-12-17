/**
 * Employee Import Script for Roof HR
 *
 * This script imports/updates 150+ employees from TheRoofDocs.
 * - Updates existing employees by email
 * - Creates new employees if they don't exist
 * - All employees marked as active
 * - Sales Rep + Field Tech = 1099
 * - All other roles = W2
 *
 * Run: npx tsx server/scripts/import-employees.ts
 */

import { db } from '../db';
import { users } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

// Role mapping from source to system
type SystemRole = 'TRUE_ADMIN' | 'ADMIN' | 'GENERAL_MANAGER' | 'TERRITORY_SALES_MANAGER' | 'MANAGER' | 'EMPLOYEE' | 'CONTRACTOR' | 'SALES_REP' | 'FIELD_TECH';
type EmploymentType = 'W2' | '1099' | 'CONTRACTOR' | 'SUB_CONTRACTOR';

interface RoleMapping {
  role: SystemRole;
  employmentType: EmploymentType;
  department: string;
}

function mapRole(sourceRole: string): RoleMapping {
  const normalized = sourceRole.toLowerCase().trim();

  switch (normalized) {
    case 'admin':
      return { role: 'ADMIN', employmentType: 'W2', department: 'Administration' };
    case 'sales manager':
      return { role: 'TERRITORY_SALES_MANAGER', employmentType: 'W2', department: 'Sales' };
    case 'ops manager':
      return { role: 'MANAGER', employmentType: 'W2', department: 'Operations' };
    case 'hr director':
      return { role: 'MANAGER', employmentType: 'W2', department: 'Human Resources' };
    case 'production manager':
      return { role: 'MANAGER', employmentType: 'W2', department: 'Production' };
    case 'ops assistant':
      return { role: 'EMPLOYEE', employmentType: 'W2', department: 'Operations' };
    case 'field tech':
      return { role: 'FIELD_TECH', employmentType: '1099', department: 'Field Operations' };
    case 'estimator':
      return { role: 'EMPLOYEE', employmentType: 'W2', department: 'Estimating' };
    case 'project manager':
      return { role: 'MANAGER', employmentType: 'W2', department: 'Production' };
    case 'project coordinator':
      return { role: 'EMPLOYEE', employmentType: 'W2', department: 'Production' };
    case 'field trainer':
      return { role: 'EMPLOYEE', employmentType: 'W2', department: 'Field Operations' };
    case 'sales rep':
      return { role: 'SALES_REP', employmentType: '1099', department: 'Sales' };
    default:
      return { role: 'EMPLOYEE', employmentType: 'W2', department: 'Operations' };
  }
}

// Employee data from the provided list
const employeeData = [
  // Admins
  { name: 'Mike Rafter', email: 'mike.rafter@theroofdocs.com', phone: '(703) 239-3769', role: 'Admin' },
  { name: 'Ford Barsi', email: 'ford.barsi@theroofdocs.com', phone: '(240) 354-6718', role: 'Admin' },
  { name: 'Oliver Brown', email: 'oliver.brown@theroofdocs.com', phone: '(703) 375-9618', role: 'Admin' },
  { name: 'Info TheRoofDocs', email: 'info@theroofdocs.com', phone: '(703) 786-5789', role: 'Admin' },

  // Sales Manager
  { name: 'Bruno Nacipucha', email: 'bruno.n@theroofdocs.com', phone: '(703) 239-3123', role: 'Sales Manager' },

  // Ops Managers
  { name: 'Sima Popal', email: 'sima.popal@theroofdocs.com', phone: null, role: 'Ops Manager' },
  { name: 'Brandon Pernot', email: 'brandon.pernot@theroofdocs.com', phone: '(703) 239-3705', role: 'Ops Manager' },
  { name: 'Keith Ziemba', email: 'keith.ziemba@theroofdocs.com', phone: '(703) 239-3809', role: 'Ops Manager' },
  { name: 'Brian Geoffrion', email: 'brian.geoffrion@theroofdocs.com', phone: '(703) 239-3013', role: 'Ops Manager' },
  { name: 'Star Mackey', email: 'star.mackey@theroofdocs.com', phone: '(703) 239-3033', role: 'Ops Manager' },
  { name: 'Alex Ortega', email: 'alex.ortega@theroofdocs.com', phone: '(617) 780-1666', role: 'Ops Manager' },
  { name: 'Jeremy Hayden', email: 'Jeremy.hayden@theroofdocs.com', phone: '(703) 239-3802', role: 'Ops Manager' },
  { name: 'Reese Samala', email: 'reese.samala@theroofdocs.com', phone: '(703) 239-3085', role: 'Ops Manager' },
  { name: 'Danielle Werts', email: 'danielle.w@theroofdocs.com', phone: '(703) 239-3191', role: 'Ops Manager' },
  { name: 'Ahmed Mahmoud', email: 'ahmed.mahmoud@theroofdocs.com', phone: '(703) 239-3629', role: 'Ops Manager' },
  { name: 'Jay Waseem', email: 'jay@theroofdocs.com', phone: '(703) 493-0114', role: 'Ops Manager' },

  // Ops Assistant
  { name: 'Jermaine Perkins', email: 'support@theroofdocs.com', phone: '(703) 239-3590', role: 'Ops Assistant' },

  // HR Directors
  { name: 'Ryan Ferguson', email: 'careers@theroofdocs.com', phone: '(703) 239-3222', role: 'HR Director' },
  { name: 'Tim Danelle', email: 'jobs@theroofdocs.com', phone: '(703) 239-3097', role: 'HR Director' },

  // Production Managers
  { name: 'Evan Ruszala', email: 'service@theroofdocs.com', phone: '(703) 239-4479', role: 'Production Manager' },
  { name: 'Jack Strycharz', email: 'jack@theroofdocs.com', phone: '(571) 377-9500', role: 'Production Manager' },
  { name: 'Greg Campbell', email: 'greg.campbell@theroofdocs.com', phone: '(703) 232-9169', role: 'Production Manager' },
  { name: 'Rhett Thomas', email: 'rhett@theroofdocs.com', phone: '(703) 239-3573', role: 'Production Manager' },

  // Field Techs (1099)
  { name: 'Francisco Toro', email: 'francisco.toro@theroofdocs.com', phone: '(703) 712-2019', role: 'Field Tech' },
  { name: 'Michael Murtha', email: 'michael.murtha@theroofdocs.com', phone: '(610) 479-2464', role: 'Field Tech' },
  { name: 'Ismael Coreas', email: 'ismael.coreas@theroofdocs.com', phone: '(703) 559-1443', role: 'Field Tech' },

  // Estimators
  { name: 'Steven Saravia', email: 'steven@theroofdocs.com', phone: '(703) 436-2721', role: 'Estimator' },
  { name: 'Amber Couch', email: 'estimates@theroofdocs.com', phone: '(703) 239-3014', role: 'Estimator' },
  { name: 'Danny Ticktin', email: 'danny.ticktin@theroofdocs.com', phone: '(703) 239-3095', role: 'Estimator' },

  // Project Managers
  { name: 'Cadell Barnes', email: 'cadell.barnes@theroofdocs.com', phone: '(804) 393-0634', role: 'Project Manager' },
  { name: 'Matt Fletcher', email: 'matt.fletcher@theroofdocs.com', phone: '(703) 249-9652', role: 'Project Manager' },
  { name: 'Jose Rodriguez', email: 'jose@theroofdocs.com', phone: '703-249-9824', role: 'Project Manager' },

  // Project Coordinators
  { name: 'Ramon Mastrogiuseppe', email: 'ramon@theroofdocs.com', phone: '(703) 239-4496', role: 'Project Coordinator' },
  { name: 'John O\'Brien', email: 'john@keyadjusting.com', phone: '(540) 305-6926', role: 'Project Coordinator' },
  { name: 'Mitchell St. Louis', email: 'mitchell@theroofdocs.com', phone: '(267) 217-3432', role: 'Project Coordinator' },
  { name: 'Matthew Bothner', email: 'matt.bothner@theroofdocs.com', phone: '(703) 261-4195', role: 'Project Coordinator' },
  { name: 'Ignacio Paz', email: 'ignacio.paz@theroofdocs.com', phone: '(703) 239-3616', role: 'Project Coordinator' },
  { name: 'Michael Landrum', email: 'michael.landrum@theroofdocs.com', phone: '(703) 239-4617', role: 'Project Coordinator' },
  { name: 'Sam Englehart', email: 'sam.englehart@theroofdocs.com', phone: '(703) 239-3169', role: 'Project Coordinator' },
  { name: 'Peter Feeney', email: 'Peter.feeney@theroofdocs.com', phone: '(703) 239-3175', role: 'Project Coordinator' },
  { name: 'Matt Ray', email: 'matt.ray@theroofdocs.com', phone: '(703) 239-4589', role: 'Project Coordinator' },
  { name: 'Rob Renzi', email: 'rob.renzi@theroofdocs.com', phone: '(703) 239-3639', role: 'Project Coordinator' },
  { name: 'Fernando Martinez', email: 'fernando@theroofdocs.com', phone: '(703) 239-3403', role: 'Project Coordinator' },

  // Field Trainers
  { name: 'Ryan Parker', email: 'ryan.parker@theroofdocs.com', phone: '(484) 222-3059', role: 'Field Trainer' },
  { name: 'Michael Swearingen', email: 'michael.swearingen@theroofdocs.com', phone: '(703) 239-3019', role: 'Field Trainer' },
  { name: 'Luis Esteves', email: 'luis.esteves@theroofdocs.com', phone: '(703) 594-6802', role: 'Field Trainer' },
  { name: 'Nick Bourdin', email: 'nick.bourdin@theroofdocs.com', phone: '(703) 239-3132', role: 'Field Trainer' },
  { name: 'Carlos Davila', email: 'carlos.davila@theroofdocs.com', phone: '(703) 239-3173', role: 'Field Trainer' },
  { name: 'Navid Javid', email: 'navid.javid@theroofdocs.com', phone: '(703) 239-3197', role: 'Field Trainer' },
  { name: 'Andre Mealy', email: 'andre.mealy@theroofdocs.com', phone: '(703) 239-3371', role: 'Field Trainer' },
  { name: 'Jason Brown', email: 'jason.brown@theroofdocs.com', phone: '(703) 239-3279', role: 'Field Trainer' },
  { name: 'Miguel Ocampo', email: 'miguel.ocampo@theroofdocs.com', phone: '(571) 210-1424', role: 'Field Trainer' },
  { name: 'Richie Riley', email: 'richie.riley@theroofdocs.com', phone: '(703) 239-3094', role: 'Field Trainer' },
  { name: 'Shane Santangelo', email: 'shane.santangelo@theroofdocs.com', phone: '(703) 239-4703', role: 'Field Trainer' },

  // Sales Reps (1099)
  { name: 'Tracie Phan', email: 'Tracie.Phan@theroofdocs.com', phone: '(703) 786-0223', role: 'Sales Rep' },
  { name: 'Derick Bus-Peters', email: 'derick.p@theroofdocs.com', phone: '(484) 206-5124', role: 'Sales Rep' },
  { name: 'Antonio Mota', email: 'Antonio.mota@theroofdocs.com', phone: null, role: 'Sales Rep' },
  { name: 'Ryan Kiely', email: 'Ryan.Kiely@theroofdocs.com', phone: '(267) 217-3063', role: 'Sales Rep' },
  { name: 'Zubair Habibi', email: 'zubair.h@theroofdocs.com', phone: '(703) 239-3028', role: 'Sales Rep' },
  { name: 'Andrew Stabile', email: 'Andrew.stabile@theroofdocs.com', phone: '(202) 495-8091', role: 'Sales Rep' },
  { name: 'Tavon Ray', email: 'tavon.r@theroofdocs.com', phone: '(703) 239-3570', role: 'Sales Rep' },
  { name: 'Arnulfo Reyes', email: 'arnulfo.reyes@theroofdocs.com', phone: '(703) 239-3144', role: 'Sales Rep' },
  { name: 'Mattias Kasparian', email: 'mattias.kasparian@theroofdocs.com', phone: '(703) 239-3615', role: 'Sales Rep' },
  { name: 'Jason Abudujilili', email: 'jason.abudujilili@theroofdocs.com', phone: null, role: 'Sales Rep' },
  { name: 'Hugo Manrique-Pinell', email: 'hugo.manrique-pinell@theroofdocs.com', phone: '(703) 239-3110', role: 'Sales Rep' },
  { name: 'John Mohl', email: 'john.m@theroofdocs.com', phone: '(703) 239-3634', role: 'Sales Rep' },
  { name: 'Jonathan Alquijay', email: 'jonathan.alquijay@theroofdocs.com', phone: '(703) 239-3071', role: 'Sales Rep' },
  { name: 'William Zumwalt', email: 'William.z@theroofdocs.com', phone: '(703) 401-4943', role: 'Sales Rep' },
  { name: 'Ian Thrash', email: 'ian.thrash@theroofdocs.com', phone: '(703) 239-3398', role: 'Sales Rep' },
  { name: 'Colin Koos', email: 'colin.k@theroofdocs.com', phone: '(267) 217-3139', role: 'Sales Rep' },
  { name: 'Michael Gabriel', email: 'Michael.Gabriel@theroofdocs.com', phone: '(703) 323-9453', role: 'Sales Rep' },
  { name: 'Kristian Portillo', email: 'kristian.portillo@theroofdocs.com', phone: null, role: 'Sales Rep' },
  { name: 'Kieran Sheehan', email: 'Kieran.Sheehan@theroofdocs.com', phone: '(804) 223-1769', role: 'Sales Rep' },
  { name: 'Daniel Alonso', email: 'daniel.alonso@theroofdocs.com', phone: '(703) 239-3362', role: 'Sales Rep' },
  { name: 'Fady Al Labbani', email: 'fady.allabbani@theroofdocs.com', phone: null, role: 'Sales Rep' },
  { name: 'Daniel Wang', email: 'Daniel.Wang@theroofdocs.com', phone: null, role: 'Sales Rep' },
  { name: 'Sergio Ramirez', email: 'Sergio.ramirez@theroofdocs.com', phone: null, role: 'Sales Rep' },
  { name: 'Joseph Marcella', email: 'joseph.marcella@theroofdocs.com', phone: '(484) 020-6502', role: 'Sales Rep' },
  { name: 'Ray Ren', email: 'Ray.ren@theroofdocs.com', phone: '(703) 239-3231', role: 'Sales Rep' },
  { name: 'Jimmy Brown', email: 'jimmy.brown@theroofdocs.com', phone: '(703) 239-3480', role: 'Sales Rep' },
  { name: 'Trevon Neely', email: 'trevon.n@theroofdocs.com', phone: '(703) 239-3108', role: 'Sales Rep' },
  { name: 'Aryk Smith', email: 'aryk.smith@theroofdocs.com', phone: '(703) 239-3477', role: 'Sales Rep' },
  { name: 'David Sura', email: 'David.Sura@theroofdocs.com', phone: '(703) 239-4702', role: 'Sales Rep' },
  { name: 'Marcus Vernon', email: 'marcus.vernon@theroofdocs.com', phone: '(804) 223-2673', role: 'Sales Rep' },
  { name: 'Damico Martin', email: 'damico.martin@theroofdocs.com', phone: '(301) 979-3340', role: 'Sales Rep' },
  { name: 'Daniel Mitchell', email: 'Daniel.mitchell@theroofdocs.com', phone: '(484) 206-5187', role: 'Sales Rep' },
  { name: 'Jhonatan Oyola', email: 'Jhonatan.Oyola@theroofdocs.com', phone: null, role: 'Sales Rep' },
  { name: 'Kerouls Gayed', email: 'kerouls.gayed@theroofdocs.com', phone: '(804) 223-0238', role: 'Sales Rep' },
  { name: 'Boakye Nkromah', email: 'boakye.nkromah@theroofdocs.com', phone: null, role: 'Sales Rep' },
  { name: 'Han D', email: 'han.d@theroofdocs.com', phone: '(804) 223-1549', role: 'Sales Rep' },
  { name: 'James Armel', email: 'james.armel@theroofdocs.com', phone: '(703) 239-3468', role: 'Sales Rep' },
  { name: 'Jonathan Rivera', email: 'jonathan.r@theroofdocs.com', phone: '(703) 239-3796', role: 'Sales Rep' },
  { name: 'Hunter Hall', email: 'hunter.hall@theroofdocs.com', phone: '(703) 239-3058', role: 'Sales Rep' },
  { name: 'Ibrahim Sohail', email: 'ibrahim.s@theroofdocs.com', phone: '(703) 493-0138', role: 'Sales Rep' },
  { name: 'Elijah Hicks', email: 'elijah.hicks@theroofdocs.com', phone: '(703) 239-3686', role: 'Sales Rep' },
  { name: 'Fabrizio Gonzalez', email: 'Fabrizio.Gonzalez@theroofdocs.com', phone: '(703) 239-3778', role: 'Sales Rep' },
  { name: 'Benjamin Salgado', email: 'ben.salgado@theroofdocs.com', phone: '(703) 239-3134', role: 'Sales Rep' },
  { name: 'Tristan Emerson', email: 'tristan.e@theroofdocs.com', phone: '(703) 239-3467', role: 'Sales Rep' },
  { name: 'Jon Meyer', email: 'Jon.meyer@theroofdocs.com', phone: '(838) 200-8631', role: 'Sales Rep' },
  { name: 'Walid Saidani', email: 'walid.s@theroofdocs.com', phone: '(703) 239-3441', role: 'Sales Rep' },
  { name: 'Joseph Ammendola', email: 'joseph.ammendola@theroofdocs.com', phone: '(484) 206-5019', role: 'Sales Rep' },
  { name: 'Michael Brawner', email: 'michael.brawner@theroofdocs.com', phone: '(703) 239-3381', role: 'Sales Rep' },
  { name: 'Abraham Raz', email: 'abraham.raz@theroofdocs.com', phone: '(703) 239-3191', role: 'Sales Rep' },
  { name: 'Eric Rickel', email: 'eric.rickel@theroofdocs.com', phone: '(484) 206-5130', role: 'Sales Rep' },
  { name: 'Jalen Simms', email: 'jalen.s@theroofdocs.com', phone: '(703) 239-3106', role: 'Sales Rep' },
  { name: 'Larry Hale', email: 'larry.hale@theroofdocs.com', phone: '(703) 239-4762', role: 'Sales Rep' },
  { name: 'Steve McKim', email: 'steve.mckim@theroofdocs.com', phone: '(703) 239-3412', role: 'Sales Rep' },
  { name: 'Doron Tauber', email: 'doron.tauber@theroofdocs.com', phone: null, role: 'Sales Rep' },
  { name: 'Devin Fraser', email: 'devin.fraser@theroofdocs.com', phone: '(703) 239-3419', role: 'Sales Rep' },
  { name: 'Ben Gohh', email: 'ben.gohh@theroofdocs.com', phone: '(401) 787-4131', role: 'Sales Rep' },
  { name: 'Ross Renzi', email: 'ross.renzi@theroofdocs.com', phone: '(703) 239-3111', role: 'Sales Rep' },
  { name: 'Tim Kelley', email: 'tim.kelley@theroofdocs.com', phone: '(571) 419-4049', role: 'Sales Rep' },
  { name: 'Francis Joe', email: 'Francis.joe@theroofdocs.com', phone: null, role: 'Sales Rep' },
  { name: 'George Gerdes', email: 'george.g@theroofdocs.com', phone: '(804) 223-2366', role: 'Sales Rep' },
  { name: 'Ziggy Smith', email: 'Ziggy.smith@theroofdocs.com', phone: null, role: 'Sales Rep' },
  { name: 'Christian Bratton', email: 'christian.bratton@theroofdocs.com', phone: '(703) 239-3199', role: 'Sales Rep' },
  { name: 'Kevin Maloney', email: 'Kevin.Maloney@theroofdocs.com', phone: '(808) 219-5968', role: 'Sales Rep' },
  { name: 'Sydney Hager', email: 'Sydney.hager@theroofdocs.com', phone: null, role: 'Sales Rep' },
  { name: 'Rinad Karim', email: 'rinad.karim@theroofdocs.com', phone: null, role: 'Sales Rep' },
  { name: 'Mohammed Fazelyar', email: 'mo.f@theroofdocs.com', phone: '(703) 239-3129', role: 'Sales Rep' },
  { name: 'Colby Mahlstede', email: 'colby.mahlstede@theroofdocs.com', phone: '(801) 663-1117', role: 'Sales Rep' },
  { name: 'Garett Dunn-Ford', email: 'garrett.d@theroofdocs.com', phone: '(703) 239-3819', role: 'Sales Rep' },
  { name: 'Joseph Boyd', email: 'joseph.boyd@theroofdocs.com', phone: '(804) 223-2167', role: 'Sales Rep' },
  { name: 'Thien Trinh', email: 'thien.trinh@theroofdocs.com', phone: '(571) 278-4378', role: 'Sales Rep' },
  { name: 'Avian Hicks', email: 'avian.hicks@theroofdocs.com', phone: '(703) 239-3260', role: 'Sales Rep' },
  { name: 'Esteban Hernandez', email: 'Esteban.Hernandez@theroofdocs.com', phone: null, role: 'Sales Rep' },
  { name: 'Chris Aycock', email: 'chris.aycock@theroofdocs.com', phone: '(703) 239-3034', role: 'Sales Rep' },
  { name: 'Joseph Hong', email: 'joseph.hong@theroofdocs.com', phone: '(703) 239-4737', role: 'Sales Rep' },
  { name: 'Basel Halim', email: 'basel.halim@theroofdocs.com', phone: '(703) 239-3618', role: 'Sales Rep' },
  { name: 'Jamal Washington', email: 'jamal.washington@theroofdocs.com', phone: '(703) 239-3437', role: 'Sales Rep' },
  { name: 'Saumair Gowani', email: 'saumair.gowani@theroofdocs.com', phone: '(804) 418-5507', role: 'Sales Rep' },
  { name: 'Ruben Luciano', email: 'ruben.luciano@theroofdocs.com', phone: '(626) 343-3074', role: 'Sales Rep' },
  { name: 'Humberto Berrio', email: 'humberto.berrio@theroofdocs.com', phone: '(703) 239-4478', role: 'Sales Rep' },
  { name: 'Truitt Todd', email: 'Truitt.todd@theroofdocs.com', phone: '(386) 867-5446', role: 'Sales Rep' },
  { name: 'Isaiah Wilson', email: 'Isaiah.wilson@theroofdocs.com', phone: null, role: 'Sales Rep' },
  { name: 'Gabe Long', email: 'gabe.long@theroofdocs.com', phone: '(703) 239-3446', role: 'Sales Rep' },
  { name: 'Eric Philippeau', email: 'eric.p@theroofdocs.com', phone: '(267) 217-3202', role: 'Sales Rep' },
  { name: 'Joshua Ampolsk', email: 'joshua.ampolsk@theroofdocs.com', phone: '(484) 206-5172', role: 'Sales Rep' },
  { name: 'Mohamed Abdelaty', email: 'mohamed.abdelaty@theroofdocs.com', phone: '(571) 856-4991', role: 'Sales Rep' },
  { name: 'Evan Gonzalez', email: 'evan.g@theroofdocs.com', phone: '(703) 239-3473', role: 'Sales Rep' },
  { name: 'Michael Mulkerin', email: 'Michael.mulkerin@theroofdocs.com', phone: '(703) 239-3163', role: 'Sales Rep' },
  { name: 'Michael Brooks', email: 'michael.brooks@theroofdocs.com', phone: '(703) 239-3565', role: 'Sales Rep' },
  { name: 'Niyi Shomade', email: 'Niyi.shomade@theroofdocs.com', phone: '(771) 444-0026', role: 'Sales Rep' },
  { name: 'Freddy Zellers', email: 'freddy.zellers@theroofdocs.com', phone: '(703) 239-3170', role: 'Sales Rep' },
  { name: 'Jose Umana', email: 'jose.u@theroofdocs.com', phone: '(703) 239-3035', role: 'Sales Rep' },
  { name: 'Rodrigo Lopez', email: 'rodrigo.lopez@theroofdocs.com', phone: '(703) 239-3239', role: 'Sales Rep' },
  { name: 'Martin Travezano', email: 'Martin.Travezano@theroofdocs.com', phone: '(703) 323-9450', role: 'Sales Rep' },
  { name: 'Angel Ardid-Balmes', email: 'angel.ardid-balmes@theroofdocs.com', phone: '(703) 239-3592', role: 'Sales Rep' },
  { name: 'Kyrie Belk', email: 'Kyrie.Belk@theroofdocs.com', phone: null, role: 'Sales Rep' },
  { name: 'William Marshall', email: 'William.marshall@theroofdocs.com', phone: '(943) 900-8556', role: 'Sales Rep' },
  { name: 'Brett McCrane', email: 'brett.m@theroofdocs.com', phone: '(703) 239-4617', role: 'Sales Rep' },
];

// Parse name into first and last name
function parseName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(' ');
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }
  const firstName = parts[0];
  const lastName = parts.slice(1).join(' ');
  return { firstName, lastName };
}

async function importEmployees() {
  console.log('=== Starting Employee Import ===');
  console.log(`Total employees to process: ${employeeData.length}`);

  const stats = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [] as string[]
  };

  const defaultPassword = await bcrypt.hash('Welcome2025!', 10);
  const today = new Date().toISOString().split('T')[0];

  for (const emp of employeeData) {
    try {
      const { firstName, lastName } = parseName(emp.name);
      const mapping = mapRole(emp.role);
      const emailLower = emp.email.toLowerCase();

      // Check if user exists (case-insensitive email)
      const existingUsers = await db.select().from(users);
      const existingUser = existingUsers.find(u => u.email.toLowerCase() === emailLower);

      if (existingUser) {
        // Update existing user
        await db.update(users).set({
          firstName,
          lastName,
          role: mapping.role,
          employmentType: mapping.employmentType,
          department: mapping.department,
          position: emp.role,
          phone: emp.phone || existingUser.phone,
          isActive: true
        }).where(eq(users.id, existingUser.id));

        console.log(`[UPDATED] ${emp.name} (${emp.email})`);
        stats.updated++;
      } else {
        // Create new user
        const id = uuidv4();
        await db.insert(users).values({
          id,
          email: emp.email,
          firstName,
          lastName,
          role: mapping.role,
          employmentType: mapping.employmentType,
          department: mapping.department,
          position: emp.role,
          hireDate: today,
          phone: emp.phone,
          passwordHash: defaultPassword,
          isActive: true,
          mustChangePassword: true
        });

        console.log(`[CREATED] ${emp.name} (${emp.email}) - ${mapping.role}/${mapping.employmentType}`);
        stats.created++;
      }
    } catch (error: any) {
      console.error(`[ERROR] ${emp.name} (${emp.email}): ${error.message}`);
      stats.errors.push(`${emp.name}: ${error.message}`);
    }
  }

  console.log('\n=== Import Complete ===');
  console.log(`Created: ${stats.created}`);
  console.log(`Updated: ${stats.updated}`);
  console.log(`Errors: ${stats.errors.length}`);

  if (stats.errors.length > 0) {
    console.log('\nErrors:');
    stats.errors.forEach(e => console.log(`  - ${e}`));
  }

  process.exit(0);
}

importEmployees().catch(console.error);
