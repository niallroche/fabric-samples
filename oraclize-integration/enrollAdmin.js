

/*
* Copyright IBM Corp All Rights Reserved
*
* SPDX-License-Identifier: Apache-2.0
*/
/*
 * Enroll the admin user
 */

const Fabric_Client = require('fabric-client');
const Fabric_CA_Client = require('fabric-ca-client');
const path = require('path');

const config = require('./config.json');

//
const fabric_client = new Fabric_Client();
let fabric_ca_client = null;
let admin_user = null;
const member_user = null;
const store_path = path.join(__dirname, 'hfc-key-store');
console.log(` Store path:${store_path}`);

// create the key value store as defined in the fabric-client/config/default.json 'key-value-store' setting
Fabric_Client.newDefaultKeyValueStore({ path: store_path }).then((state_store) => {
  // assign the store to the fabric client
  fabric_client.setStateStore(state_store);
  const crypto_suite = Fabric_Client.newCryptoSuite();
  // use the same location for the state store (where the users' certificate are kept)
  // and the crypto store (where the users' keys are kept)
  const crypto_store = Fabric_Client.newCryptoKeyStore({ path: store_path });
  crypto_suite.setCryptoKeyStore(crypto_store);
  fabric_client.setCryptoSuite(crypto_suite);
  const	tlsOptions = {
    trustedRoots: [],
    verify: false,
  };
    // be sure to change the http to https when the CA is running TLS enabled
  fabric_ca_client = new Fabric_CA_Client(config.caHost, tlsOptions, config.caUrl, crypto_suite);

  // first check to see if the admin is already enrolled
  return fabric_client.getUserContext(config.adminUsername, true);
}).then((user_from_store) => {
  if (user_from_store && user_from_store.isEnrolled()) {
    console.log('Successfully loaded admin from persistence');
    admin_user = user_from_store;
    return null;
  }
  // need to enroll it with CA server
  return fabric_ca_client.enroll({
    enrollmentID: config.adminUsername,
    enrollmentSecret: config.adminSecret,
  }).then((enrollment) => {
    console.log('Successfully enrolled admin user "admin"');
    return fabric_client.createUser(
      {
        username: config.adminUsername,
        mspid: config.mspId,
        cryptoContent: { privateKeyPEM: enrollment.key.toBytes(), signedCertPEM: enrollment.certificate },
      },
    );
  }).then((user) => {
    admin_user = user;
    return fabric_client.setUserContext(admin_user);
  }).catch((err) => {
    console.error(`Failed to enroll and persist admin. Error: ${err.stack}` ? err.stack : err);
    throw new Error('Failed to enroll admin');
  });
}).then(() => {
  console.log(`Assigned the admin user to the fabric client ::${admin_user.toString()}`);
})
  .catch((err) => {
    console.error(`Failed to enroll admin: ${err}`);
  });
