import { productModel, userModel, biddingHistoryModel, productCommentModel } from '../../models/index.js';
import { sendMail } from '../../utils/mailer.js';

export async function postComment({ productId, userId, content, parentId, protocol, host }) {
  if (!content || content.trim().length === 0) {
    throw new Error('Comment cannot be empty');
  }

  await productCommentModel.createComment(productId, userId, content.trim(), parentId || null);

  const product = await productModel.findByProductId2(productId, null);
  const commenter = await userModel.findById(userId);
  const seller = await userModel.findById(product.seller_id);
  const productUrl = `${protocol}://${host}/products/detail?id=${productId}`;

  const isSellerReplying = userId === product.seller_id;

  if (isSellerReplying && parentId) {
    // Seller replying — notify all bidders/commenters
    const [bidders, commenters] = await Promise.all([
      biddingHistoryModel.getUniqueBidders(productId),
      productCommentModel.getUniqueCommenters(productId),
    ]);

    const recipientsMap = new Map();
    for (const b of bidders) {
      if (b.id !== product.seller_id && b.email) {
        recipientsMap.set(b.id, { email: b.email, fullname: b.fullname });
      }
    }
    for (const c of commenters) {
      if (c.id !== product.seller_id && c.email) {
        recipientsMap.set(c.id, { email: c.email, fullname: c.fullname });
      }
    }

    await Promise.allSettled(
      Array.from(recipientsMap.values()).map(recipient =>
        sendMail({
          to: recipient.email,
          subject: `Seller answered a question on: ${product.name}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #667eea;">Seller Response on Product</h2>
              <p>Dear <strong>${recipient.fullname}</strong>,</p>
              <p>The seller has responded to a question on a product you're interested in:</p>
              <div style="background-color: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0;">
                <p><strong>Product:</strong> ${product.name}</p>
                <p><strong>Seller:</strong> ${seller.fullname}</p>
                <p><strong>Answer:</strong></p>
                <p style="background-color: white; padding: 15px; border-radius: 5px; border-left: 4px solid #667eea;">${content}</p>
              </div>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${productUrl}" style="display: inline-block; background-color: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                  View Product
                </a>
              </div>
              <p style="color: #888; font-size: 12px;">This is an automated message from Online Auction. Please do not reply to this email.</p>
            </div>
          `,
        })
      )
    );
  } else if (seller && seller.email && userId !== product.seller_id) {
    const isReply = !!parentId;
    await sendMail({
      to: seller.email,
      subject: isReply
        ? `New reply on your product: ${product.name}`
        : `New question about your product: ${product.name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #667eea;">${isReply ? 'New Reply on Your Product' : 'New Question About Your Product'}</h2>
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <p><strong>Product:</strong> ${product.name}</p>
            <p><strong>From:</strong> ${commenter.fullname}</p>
            <p><strong>${isReply ? 'Reply' : 'Question'}:</strong></p>
            <p style="background-color: white; padding: 15px; border-radius: 5px;">${content}</p>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${productUrl}" style="display: inline-block; background-color: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
              View Product & ${isReply ? 'Reply' : 'Answer'}
            </a>
          </div>
        </div>
      `,
    });
  }
}
