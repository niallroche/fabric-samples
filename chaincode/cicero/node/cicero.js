/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */


const shim = require('fabric-shim');

const { Template } = require('@accordproject/cicero-core');
const { Clause } = require('@accordproject/cicero-core');
const { Engine } = require('@accordproject/cicero-engine');

/**
 * Hyperledger Fabric chaincode to deploy and execute an Accord Project
 * Cicero Smart Legal Contract on-chain.
 */
class Chaincode {
  /**
   * Called by the stub to initialize the chaincode.
   * @param {*} stub the HLF stub
   */
  async Init(stub) {
    console.info('=========== Instantiated cicero chaincode ===========');
    return shim.success();
  }

  /**
   * Called by the stub when a transaction is submitted.
   * @param {*} stub the HLF stub
   */
  async Invoke(stub) {
    const ret = stub.getFunctionAndParameters();
    console.info(ret);

    const method = this[ret.fcn];
    if (!method) {
      console.error(`no function of name:${ret.fcn} found`);
      throw new Error(`Received unknown function ${ret.fcn} invocation`);
    }
    try {
      const payload = await method(stub, ret.params);
      return shim.success(payload);
    } catch (err) {
      console.log(err);
      return shim.error(err);
    }
  }

  /**
   * Initializes the ledger.
   * @param {*} stub the HLF stub
   * @param {Array} args function arguments
   */
  async initLedger(stub, args) {
    console.info('============= START : Initialize Ledger ===========');
    console.info('============= END : Initialize Ledger ===========');
  }

  /**
   * Deploys a Smart Legal Contract to the ledger
   * @param {*} stub the HLF stub
   * @param {Array} args function arguments
   * <ol>
   *   <li>contractId (string), the identifier of the contract. Used on subsequent calls
   *      to `executeSmartLegalContract`.
   *   <li>templateData (base64 encoded string), a base-64 encoded Cicero template archive.
   *   <li>contractData (JSON string), the JSON object (as a string) that parameterizes the
   *      templates. Must be a valid instance of the template model for the contract.
   * </ol>
   */
  async deploySmartLegalContract(stub, args) {
    console.info('============= START : Deploy Smart Contract ===========');
    if (args.length !== 3) {
      throw new Error('Incorrect number of arguments. Expecting 3 (Contract ID, Template Base64, Contract Data)');
    }

    const contractId = args[0];
    const templateData = args[1];
    const contractData = args[2];

    // check that the template is valid
    const template = await Template.fromArchive(Buffer.from(templateData, 'base64'));
    console.info(`Loaded template: ${template.getIdentifier()}`);

    // validate and save the contract data
    const clause = new Clause(template);
    clause.setData(JSON.parse(contractData));
    await stub.putState(`${contractId}-Data`, Buffer.from(JSON.stringify(clause.getData())));
    console.info(`Saved contract data: ${JSON.stringify(clause.getData())}`);

    // save the template data
    await stub.putState(`${contractId}-Template`, templateData);
    console.info(`Saved bytes of template data: ${templateData.length}`);

    console.info(`Successfully deployed contract ${contractId} based on ${template.getIdentifier()}`);

    // Initiate the template
    const engine = new Engine();
    const result = await engine.init(clause);
    console.info(`Response from engine execute: ${JSON.stringify(result)}`);

    // save the state
    await stub.putState(`${contractId}-State`, Buffer.from(JSON.stringify(result.state)));

    // emit any events
    if (result.emit.length > 0) {
      await stub.setEvent(`${contractId}-Init-Events`, Buffer.from(JSON.stringify(result.emit)));
    }

    // return the response
    return Buffer.from(JSON.stringify(result.response));
  }

  /**
   * Executes a previously deployed Smart Legal Contract, returning results and emitting events.
   * @param {*} stub the HLF stub
   * @param {Array} args function arguments
   * <ol>
   *   <li>contractId (string), the identifier of the contract. Used on subsequent
   *       calls to `executeSmartLegalContract`.
   *   <li>request (JSON string), the JSON object (as a string) for request object
   *       for the contract. Must be a valid instance of a contract request type.
   * </ol>
   */
  async executeSmartLegalContract(stub, args) {
    console.info('============= START : Execute Smart Contract ===========');
    if (args.length !== 2) {
      throw new Error('Incorrect number of arguments. Expecting 2 (Contract ID, Request)');
    }

    const contractId = args[0];
    const requestText = args[1];

    // load the template
    const templateDataArray = await stub.getState(`${contractId}-Template`);
    if (!templateDataArray) {
      throw new Error(`Did not find an active contract ${contractId}. Ensure it has been deployed. (1)`);
    }
    const templateDataString = Buffer.from(templateDataArray).toString();
    console.info(`Loaded template data: ${templateDataString}`);
    const template = await Template.fromArchive(Buffer.from(templateDataString, 'base64'));
    console.info(`Loaded template: ${template.getIdentifier()}`);

    // load data
    const dataAsBytes = await stub.getState(`${contractId}-Data`);
    if (!dataAsBytes) {
      throw new Error(`Did not find an active contract ${contractId}. Ensure it has been deployed. (2)`);
    }
    const data = JSON.parse(dataAsBytes);

    // load state
    const stateAsBytes = await stub.getState(`${contractId}-State`);
    if (!stateAsBytes) {
      throw new Error(`Did not find an active contract ${contractId}. Ensure it has been deployed. (3)`);
    }
    const state = JSON.parse(stateAsBytes);

    // parse the request
    const request = JSON.parse(requestText);

    // set the clause data
    const clause = new Clause(template);
    clause.setData(data);

    // execute the engine
    const engine = new Engine();
    const result = await engine.execute(clause, request, state);
    console.info(`Response from engine execute: ${JSON.stringify(result)}`);

    // save the state
    await stub.putState(`${contractId}-State`, Buffer.from(JSON.stringify(result.state)));

    // emit any events
    if (result.emit.length > 0) {
      await stub.setEvent(`${contractId}-${request.transactionId}-Events`, Buffer.from(JSON.stringify(result.emit)));
    }

    // return the response
    console.info('============= END : Execute Smart Contract ===========');
    return Buffer.from(JSON.stringify(result.response));
  }
}

shim.start(new Chaincode());
