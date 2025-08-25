const jwt = require('jsonwebtoken');
const { secretkey } = process.env;

const generateJWT = (user) => {
  return jwt.sign({ username: user.username ,role:user.role}, secretkey, { expiresIn: '1d' });
};
