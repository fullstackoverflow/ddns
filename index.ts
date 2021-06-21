import { Logger } from '@tosee/log';
import Axios from 'axios';
import { setInterval, setTimeout } from 'timers';

type Record = { id: string, name: string, content: string };

const logger = new Logger("DDNS");

class DDNS {

    constructor() {
        setInterval(() => {
            logger.info("start sync...");
            this.sync().then(() => {
                logger.info("sync end");
            });
        }, Number(process.env.TIME) || 30 * 60 * 1000);
    }

    private async getip(): Promise<string> {
        const ip_response = await Axios.get<string>("https://api.ip.sb/ip");
        logger.info("ip response:", ip_response.data);
        return ip_response.data.replaceAll(" ", "").replaceAll("\n", "").replaceAll("\r", "");
    }

    private async update(zoneid: string, record: Record, ip: string) {
        await Axios.put(
            `https://api.cloudflare.com/client/v4/zones/${zoneid}/dns_records/${record.id}`,
            {
                "type": "A",
                "name": record.name,
                "content": ip,
                "ttl": 120,
                "proxied": false
            },
            {
                headers: {
                    "X-Auth-Email": process.env.EMAIL,
                    "X-Auth-Key": process.env.AUTH_KEY
                }
            }
        )
    }

    private async getzones(): Promise<string[]> {
        const zone_response = await Axios.get("https://api.cloudflare.com/client/v4/zones", {
            headers: {
                "X-Auth-Email": process.env.EMAIL,
                "X-Auth-Key": process.env.AUTH_KEY
            }
        });
        return zone_response.data.result.map(i => i.id);
    }

    private async getrecords(zoneid: string): Promise<Record[]> {
        const zone_response = await Axios.get(`https://api.cloudflare.com/client/v4/zones/${zoneid}/dns_records?type=A`, {
            headers: {
                "X-Auth-Email": process.env.EMAIL,
                "X-Auth-Key": process.env.AUTH_KEY,
                "Content-Type": "application/json"
            }
        });
        return zone_response.data.result.map(i => ({ id: i.id, name: i.name, content: i.content }));
    }

    async sync() {
        const zones = await this.getzones();
        logger.info("zone ids:", zones);
        await Promise.all(zones.map(async zoneid => {
            const records = await this.getrecords(zoneid);
            logger.info("records:", records);
            return await Promise.all(records.map(async record => {
                const ip = await this.getip();
                logger.info("ip now:", ip);
                logger.info("ip record:", record.content);
                if (record.content != ip) {
                    logger.info("trigger Update")
                    await this.update(zoneid, record, ip);
                }
            }));
        }));
    }
}

new DDNS().sync();