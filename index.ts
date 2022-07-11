import { PrivKey, Script, PubKey, OpCode } from '@ts-bitcoin/core'
import { writeFileSync } from 'fs';
import { join } from 'path';

function createERPRedeemScript(fedThreshold: number, fedPubKeys: PubKey[], erpThreshold: number, erpPubKeys: PubKey[], timelock: number) {
    // This implementation tries to be as obvious as possible, only using
    // primitives to aid writing data to the script provided by the library.
    // This is RSKIP that describes it.
    //   https://github.com/rsksmart/RSKIPs/blob/master/IPs/RSKIP201.md
    // OP_NOTIF
    //     OP_PUSHNUM_M
    //     OP_PUSHBYTES_33 pubkey1
    //     ...
    //     OP_PUSHBYTES_33 pubkeyN
    //     OP_PUSHNUM_N
    // OP_ELSE
    //     OP_PUSHBYTES_2 <time-lock-value>
    //     OP_CSV
    //     OP_DROP
    //     OP_PUSHNUM_2
    //     OP_PUSHBYTES_33 emergencyPubkey1
    //     OP_PUSHBYTES_33 emergencyPubkey2
    //     OP_PUSHBYTES_33 emergencyPubkey3
    //     OP_PUSHNUM_3
    // OP_ENDIF
    // OP_CHECKMULTISIG


    let sortedFederators: PubKey[] = Script.sortPubKeys(fedPubKeys);
    let sortedEmergencyResponders: PubKey[] = Script.sortPubKeys(erpPubKeys)
    let script = new Script()

    script.writeOpCode(OpCode.OP_NOTIF);

    // This is a traditional multisig operation without the
    // CHECK MULTISIG at the end.
    script.writeNumber(fedThreshold);
    for (const key of sortedFederators) {
        // This will write 33 + key, completing the OP_PUSHBYTES_33 pubkeyN
        // part of the script.
        script.writeBuffer(key.toBuffer())
    }
    script.writeNumber(sortedFederators.length);

    script.writeOpCode(OpCode.OP_ELSE)

    script.writeNumber(timelock);
    script.writeOpCode(OpCode.OP_CHECKSEQUENCEVERIFY);
    script.writeOpCode(OpCode.OP_DROP);

    // If timelock ok, then check emergency responder signatures
    // Interestingly, OP_WRITEOPCODEDATA2 is used here instead of
    // deciding writeOpCode data dinamically. This is a difference between
    // implementation and RSKIP. Here we choose to follow RSKIP.
    script.writeNumber(erpThreshold);
    for (const key of sortedEmergencyResponders) {
        script.writeBuffer(key.toBuffer())
    }
    script.writeNumber(sortedEmergencyResponders.length);

    script.writeOpCode(OpCode.OP_ENDIF)

    // In any case, check one of the two set of sigantures
    script.writeOpCode(OpCode.OP_CHECKMULTISIG)
    return script
}

function createERPRedeemScriptByRSKIP(fedPubKeys: PubKey[], erpPubKeys: PubKey[], timelock: number) {
    // This implementation follows the RSKIP more to the letter, not allowing you to change the ERP fed numbers
    // The RSKIP states that the ERP federatios is a 3/4 multisig... but then the example code says it is a 2/3 multisig.
    // Here we chose to follow what was written and not the pseudocode.
    if (erpPubKeys.length != 4) {
        return null
    }
    return createERPRedeemScriptByRSKJ(fedPubKeys, erpPubKeys, timelock)
}

function createERPRedeemScriptByRSKJ(fedPubKeys: PubKey[], erpPubKeys: PubKey[], timelock: number): Script {
    // In RSKj, the threshold is hardcoded to be (pubkeys / 2 + 1), so we follow that here
    const fedThreshold = Math.floor(fedPubKeys.length / 2) + 1;
    const erpThreshold = Math.floor(erpPubKeys.length / 2) + 1;
    return createERPRedeemScript(fedThreshold, fedPubKeys, erpThreshold, erpPubKeys, timelock)
}


class RedeemScript {
    mainFed: PubKey[];
    emergencyFed: PubKey[];
    timelock: number;
    script: Script;
    invalid: boolean;

    constructor(mainFed: PubKey[], emergencyFed: PubKey[], timelock: number) {
        this.mainFed = mainFed;
        this.emergencyFed = emergencyFed;
        this.timelock = timelock;
        this.script = createERPRedeemScriptByRSKJ(mainFed, emergencyFed, timelock);
        this.invalid = !this.isValid();
    }

    private isValid(): boolean {
        const mainFedSizeOK = this.mainFed.length > 0 && this.mainFed.length < 16;
        const emergencyFedSizeOK = this.emergencyFed.length > 0 && this.emergencyFed.length < 16;
        const timelockOK = this.timelock > 0 && this.timelock < 2 ** 16 - 1;
        return mainFedSizeOK && emergencyFedSizeOK && timelockOK
    }

    toObject(): object {
        let scriptHex = this.script.toHex();
        return {
            "mainFed": this.mainFed.map(key => key.toString()),
            "emergencyFed": this.emergencyFed.map(key => key.toString()),
            "timelock": this.timelock,
            "script": scriptHex,
        }
    }
}

function randomInt(min: number, max: number) {
    return Math.floor(Math.random() * (max - min) + min);
}

function createRandomPublicKeys(max: number) {
    let n = randomInt(1, max);
    let fed: PubKey[] = [];
    for (let i = 0; i < n; i++) {
        let priv = PrivKey.fromRandom();
        let pub = PubKey.fromPrivKey(priv);
        fed.push(pub);
    }
    return fed;
}

function createRandomRedeemScript(): RedeemScript {
    // 16 is the max. allowed to be in a check multisig operation by bitcoinj
    const maxFederators = 16;
    const maxEmergencyResponders = 16;
    const randomTimelock = randomInt(256, 65536);
    const mainFed = createRandomPublicKeys(maxFederators);
    const emergencyFed = createRandomPublicKeys(maxEmergencyResponders);

    return new RedeemScript(mainFed, emergencyFed, randomTimelock);
}

function createRandomInvalidRedeemScript(): RedeemScript {
    // 16 is the max. allowed to be in a check multisig operation by bitcoinj
    const maxFederators = 128;
    const maxEmergencyResponders = 128;
    const randomTimelock = randomInt(0, 4294967295);
    const mainFed = createRandomPublicKeys(maxFederators);
    const emergencyFed = createRandomPublicKeys(maxEmergencyResponders);
    return new RedeemScript(mainFed, emergencyFed, randomTimelock);
}

function createRedeemScriptWithMSBSetToOne(): RedeemScript {
    // 16 is the max. allowed to be in a check multisig operation by bitcoinj
    const maxFederators = 16;
    const maxEmergencyResponders = 16;
    const mainFed = createRandomPublicKeys(maxFederators);
    const emergencyFed = createRandomPublicKeys(maxEmergencyResponders);

    // 51691 is a number than when interpreted as LE varint has a one
    // as the MSB. This was a bug in RSKj parser, which would strip
    // the leading zero necessary and would create redeem scripts
    // that bitcoin would interpret as negative.
    return new RedeemScript(mainFed, emergencyFed, 51691);
}

// BUGS_VALID is an array of functions with no parameters
// that construct redeem scripts that are valid and
// where parsed incorrectly. This is useful to always create
// at least one redeem script that reproduce previously found bugs.
const BUGS_VALID: Function[] = [createRedeemScriptWithMSBSetToOne]

// BUGS_INVALID is as BUGS_VALID, for for invalid redeem scripts
// They should create redeem scripts that should be considered invalid.
const BUGS_INVALID: Function[] = []

export function main() {
    if (!process.argv[2]) {
        console.log("[INFO] No number of iterations given. Default: 1000.")
    }
    if (!process.argv[3]) {
        console.log("[INFO] No output file given. Default: scripts.json")
    }

    if (process.argv[2] === "help") {
        console.log("Usage: ./index.ts {iteration number} {output file path} {create invalid flag}")
        console.log("       All arguments optional")
    }

    let numberOfIter = process.argv[2] ? parseInt(process.argv[2]) : 1000
    let outputFile = process.argv[3] ? process.argv[3] : "scripts.json"
    let createInvalid = process.argv[4] !== undefined;

    console.log("[INFO] Create invalid: " + createInvalid);

    let randomCreator = createRandomRedeemScript
    let bugList = BUGS_VALID
    if (createInvalid) {
        randomCreator = createRandomInvalidRedeemScript
        bugList = BUGS_INVALID
    }

    let randomScripts: RedeemScript[] = []

    for (let i = 0; i < numberOfIter; i++) {
        let redeemScript: RedeemScript = randomCreator();
        randomScripts.push(redeemScript);
        if (i % 100 === 0) {
            console.log("[INFO] Progress: " + i + "/" + numberOfIter)
        }
    }

    for (let bugged of bugList) {
        randomScripts.push(bugged())
    }

    let objects = randomScripts.map(rs => rs.toObject())
    let json = JSON.stringify(objects);
    writeFileSync(join(__dirname, outputFile), json, { flag: "w+" });
    console.log("Done! Wrote to: " + outputFile)
}

main();

