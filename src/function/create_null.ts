
export interface DataPoint{
    step:number;
    loss:number;
}

export  function Generation(): DataPoint[]{
    const data:DataPoint[]=[]
    let currentLose=2.5
    for(let i=0; i<=1000000; i++){
        currentLose=Math.max(0.01,currentLose-0.000001+(Math.random()-0.5)*0.001)
        let lossValue=currentLose
        if(i===500000){
            lossValue=999.99
        }
        data.push({
            step:i,
            loss:lossValue
        })
    }
    return data
}



export default function DownsampleData(data: DataPoint[], targetSize: number = 1000): DataPoint[] {
    if (data.length <= targetSize) return data;

    const sampled: DataPoint[] = [];
    const blockSize = Math.floor(data.length / targetSize);

    for (let i = 0; i < data.length; i += blockSize) {
        const block = data.slice(i, i + blockSize);
        if (block.length === 0) continue;

        let minPoint = block[0];
        let maxPoint = block[0];

        for (const pt of block) {
            if (pt.loss < minPoint.loss) minPoint = pt;
            if (pt.loss > maxPoint.loss) maxPoint = pt;
        }

        sampled.push(minPoint);
        if (minPoint !== maxPoint) {
            sampled.push(maxPoint);
        }
    }

    return sampled;
}