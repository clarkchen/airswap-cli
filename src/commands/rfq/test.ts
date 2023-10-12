import chalk from 'chalk'
import {Command} from '@oclif/command'
import * as utils from '../../lib/utils'
import {getWallet} from '../../lib/wallet'
import {get, cancelled, getTokens} from '../../lib/prompt'
import * as requests from '../../lib/requests'
import BigNumber from "bignumber.js";

const swapDeploys = require('@airswap/swap-erc20/deploys.js')
const locator = "https://rfq.shieldrhino.net/"
const weth = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
const usdt = '0xdAC17F958D2ee523a2206206994597C13D831ec7'
async function getRequestLocal(wallet: any, metadata: any, kind: string) {
    const inputs: any = {
        side: {
            description: 'buy or sell',
            type: 'Side',
        },
        amount: {
            type: 'Number',
        },
    }
    let side = 'sell'
    side = 'buy'
    let amount = '0.01'
    amount = '0.01'

    let first = weth
    let second = usdt

    // const { side, amount }: any = await get(inputs)
    // const { first, second }: any = await getTokens({ first: 'of', second: 'for' }, metadata)

    let signerToken
    let senderToken

    if (side === 'buy') {
        signerToken = first
        senderToken = second
    } else {
        signerToken = second
        senderToken = first
    }

    const chainId = (await wallet.provider.getNetwork()).chainId
    const swapContract = swapDeploys[chainId]

    let method = 'getSenderSide' + kind
    const params = {
        signerToken: signerToken,
        senderToken: senderToken,
        swapContract,
        chainId: String(chainId)
    }
    console.log('params finished')
    console.log('meta data', metadata.byAddress[weth])
    console.log('meta data', metadata.byAddress[usdt])

    if (kind === 'Order') {
        Object.assign(params, {
            senderWallet: wallet.address,
        })
    }

    if (side === 'buy') {
        const signerAmountAtomic = utils.getAtomicValue(amount, first, metadata)
        console.log('signerAmountAtomic', signerAmountAtomic)
        Object.assign(params, {
            signerAmount: signerAmountAtomic.integerValue(BigNumber.ROUND_FLOOR).toFixed(),
        })
    } else {
        const senderAmountAtomic = utils.getAtomicValue(amount, first, metadata)
        method = 'getSignerSide' + kind
        Object.assign(params, {
            senderAmount: senderAmountAtomic.integerValue(BigNumber.ROUND_FLOOR).toFixed(),
        })
    }

    return {
        side,
        signerToken,
        senderToken,
        method: method + 'ERC20',
        params,
    }
}

export default class OrderGet extends Command {
    public static description = 'get an order from a peer'

    public async run() {
        try {
            console.log('rfg get start')
            const wallet = await getWallet(this)
            console.log('wallet', wallet.address)
            const chainId = 1

            const metadata = await utils.getMetadata(this, chainId)
            const gasPrice = await utils.getGasPrice(this)
            utils.displayDescription(this, OrderGet.description, chainId)


            const request = await getRequestLocal(wallet, metadata, 'Order')
            this.log()
            /*
            {
            signerToken: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
            senderToken: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
            swapContract: '0xd82FA167727a4dc6D6F55830A2c47aBbB4b3a0F8',
            chainId: '1',
            senderWallet: '0xf0c2b8BB7EFA1a02b43B59F2500AFF1C5A48ce09',
            senderAmount: '100000000000000000'
      }

             */
            this.log('start query', request.params, request.method)
            requests.peerCall(
                locator,
                request.method,
                request.params,
                async (err, order) => {
                    if (err) {
                        if (err === 'timeout') {
                            this.log(chalk.yellow('The request timed out.\n'))
                        } else {
                            cancelled(err)
                        }
                        process.exit(0)
                    } else {
                        try {
                            console.log('order is ', JSON.stringify(order));
                            await requests.validateResponse(
                                order,
                                request.method,
                                request.params,
                                wallet
                            )
                            utils.handleResponse(
                                request,
                                wallet,
                                metadata,
                                chainId,
                                gasPrice,
                                this,
                                order
                            )
                        } catch (e) {
                            cancelled(e)
                        }
                    }
                }
            )
        } catch (e) {
            cancelled(e)
        }
    }
}
