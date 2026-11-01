import { ccc, mol } from '@ckb-ccc/core';
import { writeFile } from 'node:fs/promises';
const name = 'Seedsong';
const description = { description: 'Fixture', dob: { ver: 1 } };
const input = { since: 0, previousOutput: { txHash: '0x' + '22'.repeat(32), index: 3 } };
const owner = ccc.Script.from({ codeHash: '0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8', hashType: 'type', args: '0x' + '11'.repeat(20) });
const id = ccc.hashTypeId(input, 0);
const type = ccc.Script.from({ codeHash: '0x0bbe768b519d8ea7b96d58f1182eb7e6ef96c541fbd9526975077ee09f049058', hashType: 'data1', args: id });
const ClusterData = mol.table({ name: mol.String, description: mol.String, mutantId: mol.BytesOpt });
const data = ClusterData.encode({ name, description: JSON.stringify(description) });
const Address = mol.union({ Script: ccc.Script });
const CreateCluster = mol.table({ clusterId: mol.Byte32, to: Address, dataHash: mol.Byte32 });
const SporeAction = mol.union({ CreateCluster }, { CreateCluster: 3 });
const Action = mol.table({ scriptInfoHash: mol.Byte32, scriptHash: mol.Byte32, data: mol.Bytes });
const Message = mol.table({ actions: mol.vector(Action) });
const SighashAll = mol.table({ seal: mol.Bytes, message: Message });
const Layout = mol.union({ SighashAll }, { SighashAll: 4278190081 });
const witness = Layout.encode({ type: 'SighashAll', value: { seal: '0x', message: { actions: [{
  scriptInfoHash: ccc.hashCkb(ccc.bytesFrom('CCC_DEFAULT_COBUILD_INFO', 'utf8')),
  scriptHash: type.hash(),
  data: ccc.hexFrom(SporeAction.encode({ type: 'CreateCluster', value: { clusterId: id, to: { type: 'Script', value: owner }, dataHash: ccc.hashCkb(data) } })),
}] } } });
const result = { provenance: 'Generated using @ckb-ccc/core 1.23.0 Molecule codecs and the official @ckb-ccc/spore Cluster V2/CoBuild schema; no network or private keys', name, description, clusterId: id, typeHash: type.hash(), clusterData: ccc.hexFrom(data), cobuildWitness: ccc.hexFrom(witness) };
await writeFile(new URL('./spore-cluster-v2.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
console.log({ id, dataBytes: ccc.bytesFrom(data).length, witnessBytes: ccc.bytesFrom(witness).length });
