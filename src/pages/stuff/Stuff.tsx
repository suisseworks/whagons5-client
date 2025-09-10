import { query } from "../../database/Query";

function Stuff() {

    const [stuff, setStuff] = query("stuff");

    console.log(stuff);

    return ( 
        <div>
            <h1>Stuff</h1>
            {stuff.map((item: any) => (
                <div key={item.id}>
                    <h2>{item.name}</h2>
                    <p
                    onClick={() => {
                        const newStuff = [...stuff];  // Copy array
                        newStuff[0] = { ...newStuff[0], description: "new description" };  // Copy object
                        setStuff(newStuff);
                    }}
                    >{item.description}</p>
                    
                </div>
            ))}
        </div>
     );
}

export default Stuff;