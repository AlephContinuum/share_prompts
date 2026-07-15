import { connectToDB } from '@utils/database'

export const POST = async (req,res) => {
    const { userId, prompt, tag} = await req.jason();

    try{
        await connectToDB();
    } catch (error){
        
    }

}


