# set environment variables needed to run hyperledger
# list current variables
# env
echo $PATH

# set hyperledger required paths
# set go if needed e.g. /usr/local/go/bin
# set path to include fabric-samples

export FABRICSAMPLES=$PWD
echo $FABRICSAMPLES
export PATH=$PATH:$FABRICSAMPLES/bin
echo $PATH
# export PATH/Users/niall/Documents/projects/mishcon/repo/hackathon/hyperledger/fabric-samples

# run the oraclize network
cd ../oraclize-integration/
./startFabric.sh
# make a cll to oraclize
node user-application-query.js

# check the cicero integration
cd ../cicero/

# download a cta file if not done already

# deploy the contract if not done already
# node deploy.js helloworld.cta sample.txt

# run the contract (this needs to be done with an older version of node)
 # suggest using nvm to manage multiple installations
# nvm exec 8.9.0 node --version
# nvm exec 8.9.0 node deploy.js helloworld.cta sample.txt
# nvm exec 8.9.0 node submitRequest.js request.json

nvm exec 8.9.0 node deploy.js latedeliveryandpenalty@0.13.0.cta sample.txt
nvm exec 8.9.0 node submitRequest.js request.json
