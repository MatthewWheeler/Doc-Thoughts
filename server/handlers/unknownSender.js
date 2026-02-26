module.exports = function unknownSender(twiml) {
  twiml("Text JOIN <petname> to subscribe to a pet's daily thoughts. Pet owners: just text your thought.");
};
