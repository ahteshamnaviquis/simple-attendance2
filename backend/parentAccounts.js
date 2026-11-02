// Parent accounts: their details, and saving them together with a student.
//
// A parent is a user with role "parent" (users table: name, username, password,
// disabled), a profile (parent_profiles: relation, phone, altPhone, email, cnic,
// occupation, address) and links to their children (parent_students).
//
// Parents are added on the student form, not on their own: when a student is
// added or edited, `parents` lists the student's parents. Each entry is either
//   { parentId }                 an existing parent (a brother's or sister's), unchanged
//   { parentId, ...details }     an existing parent, with their details updated
//   { ...details }               a new parent account
// details = { name, relation, phone, altPhone, email, cnic, occupation, address,
//             username, password }  (password: required for a new parent,
//             blank = keep the current one).

const { HttpError, newId } = require('./helpers');

const RELATIONS = ['Father', 'Mother', 'Guardian', 'Grandparent', 'Brother', 'Sister', 'Uncle', 'Aunt', 'Other'];
const MAX_PARENTS_PER_STUDENT = 4;

const EMPTY_PROFILE = { relation: '', phone: '', altPhone: '', email: '', cnic: '', occupation: '', address: '' };

function text(value, label, max) {
  const result = String(value ?? '').trim();
  if (result.length > max) throw new HttpError(400, `${label} can be at most ${max} characters`);
  return result;
}

function cleanPhone(value, label, required) {
  const phone = text(value, label, 30);
  if (!phone) {
    if (required) throw new HttpError(400, `${label} is required`);
    return '';
  }
  const digits = phone.replace(/\D/g, '').length;
  if (!/^\+?[0-9\s()-]+$/.test(phone) || digits < 7 || digits > 15) {
    throw new HttpError(400, `${label} should be a phone number like 0300-1234567`);
  }
  return phone;
}

// Check and tidy one parent's details. `who` names the parent in error messages.
function cleanParentDetails(body, { isNew, who = 'Parent' }) {
  const name = text(body?.name, `${who}: name`, 100);
  if (!name) throw new HttpError(400, `${who}: name is required`);
  const relation = String(body?.relation ?? '');
  if (!RELATIONS.includes(relation)) throw new HttpError(400, `${who}: please choose the relation to the student`);

  const email = text(body?.email, `${who}: email`, 120).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, `${who}: please enter a valid email address`);
  }
  const cnic = text(body?.cnic, `${who}: CNIC`, 20);
  if (cnic && !/^\d{5}-?\d{7}-?\d$/.test(cnic)) {
    throw new HttpError(400, `${who}: CNIC should look like 35202-1234567-1`);
  }

  const username = String(body?.username ?? '').trim().toLowerCase();
  if (!username) throw new HttpError(400, `${who}: username is required`);
  if (!/^[a-z0-9._-]+$/.test(username)) {
    throw new HttpError(400, `${who}: username can only use letters, numbers, dot, dash and underscore`);
  }
  const password = String(body?.password ?? '');
  if (isNew && !password) throw new HttpError(400, `${who}: password is required`);

  return {
    user: { name, username, password },
    profile: {
      relation,
      phone: cleanPhone(body?.phone, `${who}: phone`, true),
      altPhone: cleanPhone(body?.altPhone, `${who}: other phone`, false),
      email,
      cnic,
      occupation: text(body?.occupation, `${who}: occupation`, 100),
      address: text(body?.address, `${who}: address`, 255),
    },
  };
}

function checkUsernameFree(users, username, exceptId) {
  const taken = users.some((u) => u.id !== exceptId && u.username.toLowerCase() === username);
  if (taken) throw new HttpError(409, `The username "${username}" is already taken`);
}

// Save a parent's details into `data` ({ users, parentProfiles }), adding the
// account when `parentId` is not given. Returns the parent's id.
function saveParentDetails(data, details, parentId) {
  const { user, profile } = details;
  checkUsernameFree(data.users, user.username, parentId);

  if (!parentId) {
    const id = newId();
    data.users = [...data.users, { id, ...user, role: 'parent' }];
    data.parentProfiles = [...data.parentProfiles, { id, ...profile }];
    return id;
  }

  const index = data.users.findIndex((u) => u.id === parentId && u.role === 'parent');
  if (index === -1) throw new HttpError(404, 'Parent not found');
  const updated = { ...data.users[index], name: user.name, username: user.username };
  if (user.password) updated.password = user.password;
  data.users = data.users.map((u, i) => (i === index ? updated : u));

  const hasProfile = data.parentProfiles.some((p) => p.id === parentId);
  data.parentProfiles = hasProfile
    ? data.parentProfiles.map((p) => (p.id === parentId ? { id: parentId, ...profile } : p))
    : [...data.parentProfiles, { id: parentId, ...profile }];
  return parentId;
}

// Check every entry of a student's `parents` list before anything is saved.
// Returns [{ parentId, details }] (details null = leave the parent as it is).
function cleanParentEntries(list) {
  if (!Array.isArray(list)) throw new HttpError(400, 'Parents must be a list');
  if (list.length > MAX_PARENTS_PER_STUDENT) {
    throw new HttpError(400, `A student can have at most ${MAX_PARENTS_PER_STUDENT} parents`);
  }
  const entries = list.map((entry, i) => {
    const who = list.length > 1 ? `Parent ${i + 1}` : 'Parent';
    const parentId = entry?.parentId ? String(entry.parentId) : null;
    const changesDetails = !parentId || entry.name !== undefined;
    return { parentId, details: changesDetails ? cleanParentDetails(entry, { isNew: !parentId, who }) : null };
  });

  const ids = entries.filter((e) => e.parentId).map((e) => e.parentId);
  if (new Set(ids).size !== ids.length) throw new HttpError(400, 'The same parent is listed twice');
  const usernames = entries.filter((e) => e.details).map((e) => e.details.user.username);
  if (new Set(usernames).size !== usernames.length) throw new HttpError(400, 'Two parents have the same username');
  return entries;
}

// Apply a student's cleaned parent entries to `data` ({ users, parentProfiles,
// parentStudents }): add or update the parents, and make them exactly the
// student's parents. Returns the parent ids, in order.
function applyParentEntries(data, studentId, entries) {
  const parentIds = entries.map(({ parentId, details }) => {
    if (details) return saveParentDetails(data, details, parentId);
    if (!data.users.some((u) => u.id === parentId && u.role === 'parent')) {
      throw new HttpError(400, 'Please choose a parent from the list');
    }
    return parentId;
  });

  const others = data.parentStudents.filter((l) => l.studentId !== studentId);
  const mine = parentIds.map(
    (parentId) =>
      data.parentStudents.find((l) => l.studentId === studentId && l.parentId === parentId) ?? {
        id: newId(),
        parentId,
        studentId,
      }
  );
  data.parentStudents = [...others, ...mine];
  return parentIds;
}

// Parents as the browser sees them: account (no password), profile and children.
function describeParents({ users, parentProfiles, parentStudents, students, classes }) {
  return users
    .filter((u) => u.role === 'parent')
    .map(({ password, ...user }) => {
      const { id, ...profile } = parentProfiles.find((p) => p.id === user.id) ?? { id: user.id, ...EMPTY_PROFILE };
      return {
        ...user,
        disabled: Boolean(user.disabled),
        ...profile,
        children: parentStudents
          .filter((l) => l.parentId === user.id)
          .map((l) => students.find((s) => s.id === l.studentId))
          .filter(Boolean)
          .map((s) => ({
            studentId: s.id,
            name: s.name,
            rollNumber: s.rollNumber,
            classId: s.classId,
            className: classes.find((c) => c.id === s.classId)?.name ?? '',
          })),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

module.exports = {
  RELATIONS,
  cleanParentDetails,
  cleanParentEntries,
  applyParentEntries,
  saveParentDetails,
  describeParents,
};
